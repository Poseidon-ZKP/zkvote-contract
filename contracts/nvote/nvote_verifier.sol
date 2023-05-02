//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
// 2021 Remco Bloemen
//       cleaned up code
//       added InvalidProve() error
//       always revert with InvalidProof() on invalid proof
//       make nvotePairing strict
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

library nvotePairing {
  error InvalidProof();

  // The prime q in the base field F_q for G1
  uint256 constant BASE_MODULUS = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

  // The prime moludus of the scalar field of G1.
  uint256 constant SCALAR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  struct G1Point {
    uint256 X;
    uint256 Y;
  }

  // Encoding of field elements is: X[0] * z + X[1]
  struct G2Point {
    uint256[2] X;
    uint256[2] Y;
  }

  /// @return the generator of G1
  function P1() internal pure returns (G1Point memory) {
    return G1Point(1, 2);
  }

  /// @return the generator of G2
  function P2() internal pure returns (G2Point memory) {
    return
      G2Point(
        [
          11559732032986387107991004021392285783925812861821192530917403151452391805634,
          10857046999023057135944570762232829481370756359578518086990519993285655852781
        ],
        [
          4082367875863433681332203403145435568316851327593401208105741076214120093531,
          8495653923123431417604973247489272438418190587263600148770280649306958101930
        ]
      );
  }

  /// @return r the negation of p, i.e. p.addition(p.negate()) should be zero.
  function negate(G1Point memory p) internal pure returns (G1Point memory r) {
    if (p.X == 0 && p.Y == 0) return G1Point(0, 0);
    // Validate input or revert
    if (p.X >= BASE_MODULUS || p.Y >= BASE_MODULUS) revert InvalidProof();
    // We know p.Y > 0 and p.Y < BASE_MODULUS.
    return G1Point(p.X, BASE_MODULUS - p.Y);
  }

  /// @return r the sum of two points of G1
  function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory r) {
    // By EIP-196 all input is validated to be less than the BASE_MODULUS and form points
    // on the curve.
    uint256[4] memory input;
    input[0] = p1.X;
    input[1] = p1.Y;
    input[2] = p2.X;
    input[3] = p2.Y;
    bool success;
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
    }
    if (!success) revert InvalidProof();
  }

  /// @return r the product of a point on G1 and a scalar, i.e.
  /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
  function scalar_mul(G1Point memory p, uint256 s) internal view returns (G1Point memory r) {
    // By EIP-196 the values p.X and p.Y are verified to less than the BASE_MODULUS and
    // form a valid point on the curve. But the scalar is not verified, so we do that explicitelly.
    if (s >= SCALAR_MODULUS) revert InvalidProof();
    uint256[3] memory input;
    input[0] = p.X;
    input[1] = p.Y;
    input[2] = s;
    bool success;
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
    }
    if (!success) revert InvalidProof();
  }

  /// Asserts the pairing check
  /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
  /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should succeed
  function pairingCheck(G1Point[] memory p1, G2Point[] memory p2) internal view {
    // By EIP-197 all input is verified to be less than the BASE_MODULUS and form elements in their
    // respective groups of the right order.
    if (p1.length != p2.length) revert InvalidProof();
    uint256 elements = p1.length;
    uint256 inputSize = elements * 6;
    uint256[] memory input = new uint256[](inputSize);
    for (uint256 i = 0; i < elements; i++) {
      input[i * 6 + 0] = p1[i].X;
      input[i * 6 + 1] = p1[i].Y;
      input[i * 6 + 2] = p2[i].X[0];
      input[i * 6 + 3] = p2[i].X[1];
      input[i * 6 + 4] = p2[i].Y[0];
      input[i * 6 + 5] = p2[i].Y[1];
    }
    uint256[1] memory out;
    bool success;
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      success := staticcall(sub(gas(), 2000), 8, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
    }
    if (!success || out[0] != 1) revert InvalidProof();
  }
}

contract nvoteVerifier {
  using nvotePairing for *;

  struct VerifyingKey {
    nvotePairing.G1Point alfa1;
    nvotePairing.G2Point beta2;
    nvotePairing.G2Point gamma2;
    nvotePairing.G2Point delta2;
    nvotePairing.G1Point[] IC;
  }

  struct Proof {
    nvotePairing.G1Point A;
    nvotePairing.G2Point B;
    nvotePairing.G1Point C;
  }

  function verifyingKey() internal pure returns (VerifyingKey memory vk) {
    vk.alfa1 = nvotePairing.G1Point(
      19085465649842209470035951276896972059207207693968749607279417588945544184207,
      2225001544686912464718843116775441565392469917335430201833863722849191485559
    );

    vk.beta2 = nvotePairing.G2Point(
      [10745735959688998095391288873048954979419825813864143867627344220803111073461, 2445872603316623681044244420253955775705588151793702579115395328262564541310],
      [13680561092934922556570980233091319457697962773137258441220395381369281315339, 4830503932761334199428908951571529197332586121936353360622561133090439190930]
    );

    vk.gamma2 = nvotePairing.G2Point(
      [11559732032986387107991004021392285783925812861821192530917403151452391805634, 10857046999023057135944570762232829481370756359578518086990519993285655852781],
      [4082367875863433681332203403145435568316851327593401208105741076214120093531, 8495653923123431417604973247489272438418190587263600148770280649306958101930]
    );

    vk.delta2 = nvotePairing.G2Point(
      [2412215638615817231543943394989977838700768662153057604070366168890854041127, 7405191698625252214089119160545142194963350473367682862705977180844147588000],
      [19292594627401945095658339421190013127296124150767988814651841737898427262858, 165976422351997668345892753835703619539924802774335948983731911721836184364]
    );

    vk.IC = new nvotePairing.G1Point[](16);

    
      vk.IC[0] = nvotePairing.G1Point(
        7908475759969570849403669915946360393509406222039003869581560489202784991788,
        4483513750473112447636253914468694550826837000178504834059138419780277405675
      );
    
      vk.IC[1] = nvotePairing.G1Point(
        15759424120374304861566134081959391928626832981661239378465740497402873164333,
        5992047268573380607682958137360991370386533352958258216227892038582651960116
      );
    
      vk.IC[2] = nvotePairing.G1Point(
        1399358540752684726185720811270123324461250270136204720804660079020626800854,
        226343197672232040085254872668332376567246715539756326444546557675524838606
      );
    
      vk.IC[3] = nvotePairing.G1Point(
        8271342632240930921027205755558527957326628488776878679477802609207074647148,
        12320380127388272991224553194899441809502846391254003853613083269705942722341
      );
    
      vk.IC[4] = nvotePairing.G1Point(
        4922652934538132945906884440479376000712275661509240078863076745312756987289,
        11535280791733839858482551387783197836616455150185460474746034321517601218041
      );
    
      vk.IC[5] = nvotePairing.G1Point(
        4142859065452259296217288236734660164744509030515539666028061246060448959705,
        21444046148395242450043972048508771197637043187542099682097198801325758994292
      );
    
      vk.IC[6] = nvotePairing.G1Point(
        8793008048212855599469462752061294895794558636987718055727863030193596236779,
        15173205447812749438948716978795662684875880997460986517760773922520972689779
      );
    
      vk.IC[7] = nvotePairing.G1Point(
        4180774598078119156144085104588484590271614501137442368409401193608690531977,
        20328412918200536958022923222023957024912315040066450772661165306523147109277
      );
    
      vk.IC[8] = nvotePairing.G1Point(
        9701038698287933826958864113227987429250937936798077174597187358665061924149,
        8693068668549487677630130995227104029579148293558366526606686559992853043468
      );
    
      vk.IC[9] = nvotePairing.G1Point(
        18454732761943494912707781841184063914050520082610623407829692258910160076370,
        1286080916893674774160189276799738451080147665304003107706786301250592330719
      );
    
      vk.IC[10] = nvotePairing.G1Point(
        15074275267359656815594771304036333999617804445119507996812670408417988434015,
        19409216702235178505404115851763956930797186995397591609572913156977734111289
      );
    
      vk.IC[11] = nvotePairing.G1Point(
        20528916326855203983764259062751967551672660108903353987074531912402029085530,
        18298829060054953989745419780340373258273910129042712641457954353233269880062
      );
    
      vk.IC[12] = nvotePairing.G1Point(
        15803680912899981247534379369986300504314353170362156364130626738259687790532,
        1080805963357275668830305224151085613619348719386723489388664800180526637812
      );
    
      vk.IC[13] = nvotePairing.G1Point(
        10559185162065877886912189959690788457639042756115619605957889206691232036518,
        1252308692977769480446045328195881578647851338434605806624235223541629353760
      );
    
      vk.IC[14] = nvotePairing.G1Point(
        17219501430824863740661766184909164219175965510076596104415942966913104873287,
        16215506750867932689089883346027462525448997644794932878639885311367116589277
      );
    
      vk.IC[15] = nvotePairing.G1Point(
        15176576810771747675412328084134885487512319786252112060416241289460695744786,
        4546904287719043424517112744050439094043386632871201472996243541800822549041
      );
    
  }

  /// @dev Verifies a Semaphore proof. Reverts with InvalidProof if the proof is invalid.
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[15] memory input
  ) public view {
    // If the values are not in the correct range, the nvotePairing contract will revert.
    Proof memory proof;
    proof.A = nvotePairing.G1Point(a[0], a[1]);
    proof.B = nvotePairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
    proof.C = nvotePairing.G1Point(c[0], c[1]);

    VerifyingKey memory vk = verifyingKey();

    // Compute the linear combination vk_x of inputs times IC
    if (input.length + 1 != vk.IC.length) revert nvotePairing.InvalidProof();
    nvotePairing.G1Point memory vk_x = vk.IC[0];
    for (uint i = 0; i < input.length; i++) {
      vk_x = nvotePairing.addition(vk_x, nvotePairing.scalar_mul(vk.IC[i+1], input[i]));
    }

    // Check pairing
    nvotePairing.G1Point[] memory p1 = new nvotePairing.G1Point[](4);
    nvotePairing.G2Point[] memory p2 = new nvotePairing.G2Point[](4);
    p1[0] = nvotePairing.negate(proof.A);
    p2[0] = proof.B;
    p1[1] = vk.alfa1;
    p2[1] = vk.beta2;
    p1[2] = vk_x;
    p2[2] = vk.gamma2;
    p1[3] = proof.C;
    p2[3] = vk.delta2;
    nvotePairing.pairingCheck(p1, p2);
  }
}
