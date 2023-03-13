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
      [8754692708242770233704306234898356111628870855875951088512649024589441939059, 13519121282795274146543281648031097069846427235158555701992435370200774543147],
      [6000052498414323120517647027281551627507053249561168089493706307717580219130, 9990016703454479528968051449366203247293219803572479149560085085039402843261]
    );

    vk.IC = new nvotePairing.G1Point[](12);

    
      vk.IC[0] = nvotePairing.G1Point(
        2140222278902438201049465883182094160940943687790794517198790628874640810753,
        8520383769025940487742252306464240865382951836119555010356285290981806621941
      );
    
      vk.IC[1] = nvotePairing.G1Point(
        8502700924169499303188189936232324902998153756408311441935375229589736335755,
        17238892568602829984731737646486631240401842274174032741811909811374164550100
      );
    
      vk.IC[2] = nvotePairing.G1Point(
        4622077793960438411658740468492878594977785403561029654113518527603583368362,
        16582640765580789917475037797000694471141359328402663785595569843861624633975
      );
    
      vk.IC[3] = nvotePairing.G1Point(
        7694905382517945405801455540768300562036857286782104498268553733342244978559,
        7037435920366162427821520098691200689707828109005908687912348377333211054577
      );
    
      vk.IC[4] = nvotePairing.G1Point(
        773242782742092822701208759015771484738120406677031987129728957988681352514,
        11857024497851855219288341637471793778418453877270422067534067699159271341959
      );
    
      vk.IC[5] = nvotePairing.G1Point(
        2565605201589779262860604477457897413076733677099040632883024968940216603935,
        3400168690573447945909833733469659793539042839618691053647771537746646299420
      );
    
      vk.IC[6] = nvotePairing.G1Point(
        18648997135787336557255351991589168863038241172459846375671545827944919668148,
        21769491650612644511180218274081378654188826619068721460638547931590450704765
      );
    
      vk.IC[7] = nvotePairing.G1Point(
        5564911509924772791271724428353678016428027264094728052727568690972369961590,
        14361365391364088451005286559405276711761765228690617250271261752683724328208
      );
    
      vk.IC[8] = nvotePairing.G1Point(
        3655353323061330773583515400188640037579551884275603701230908194367819604174,
        6754189273867563301351901700874442575529911266151244706349045690539621888151
      );
    
      vk.IC[9] = nvotePairing.G1Point(
        16023068184378354491061149995509724991456936691855281796545787715119773081095,
        18482454087007872819274860302023389002244209028480286710527936226313730457909
      );
    
      vk.IC[10] = nvotePairing.G1Point(
        17265514787063962688857573649090091670785768377300035806147177475915408941911,
        13248780434097407152392867666069663132557353042530207026856338135653163405315
      );
    
      vk.IC[11] = nvotePairing.G1Point(
        7643201524621207892624017621949263526069174405430400203812196864221415691093,
        5895440771127432262795567987146652472531344342357080490082085730483424571818
      );
    
  }

  /// @dev Verifies a Semaphore proof. Reverts with InvalidProof if the proof is invalid.
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[11] memory input
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
