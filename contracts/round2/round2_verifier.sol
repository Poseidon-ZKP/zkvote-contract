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
//       make round2Pairing strict
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

library round2Pairing {
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

contract round2Verifier {
  using round2Pairing for *;

  struct VerifyingKey {
    round2Pairing.G1Point alfa1;
    round2Pairing.G2Point beta2;
    round2Pairing.G2Point gamma2;
    round2Pairing.G2Point delta2;
    round2Pairing.G1Point[] IC;
  }

  struct Proof {
    round2Pairing.G1Point A;
    round2Pairing.G2Point B;
    round2Pairing.G1Point C;
  }

  function verifyingKey() internal pure returns (VerifyingKey memory vk) {
    vk.alfa1 = round2Pairing.G1Point(
      19085465649842209470035951276896972059207207693968749607279417588945544184207,
      2225001544686912464718843116775441565392469917335430201833863722849191485559
    );

    vk.beta2 = round2Pairing.G2Point(
      [10745735959688998095391288873048954979419825813864143867627344220803111073461, 2445872603316623681044244420253955775705588151793702579115395328262564541310],
      [13680561092934922556570980233091319457697962773137258441220395381369281315339, 4830503932761334199428908951571529197332586121936353360622561133090439190930]
    );

    vk.gamma2 = round2Pairing.G2Point(
      [11559732032986387107991004021392285783925812861821192530917403151452391805634, 10857046999023057135944570762232829481370756359578518086990519993285655852781],
      [4082367875863433681332203403145435568316851327593401208105741076214120093531, 8495653923123431417604973247489272438418190587263600148770280649306958101930]
    );

    vk.delta2 = round2Pairing.G2Point(
      [614107564300982427671171363418266127463960810932699129386348535582465851189, 18632892867460506132063066149760166409296865920218615473631109102045568707558],
      [19403716254487244294035904743333682915857987006666495842778352197366401831607, 13894241831008275505003796004341602504533057647469591740393406100516788539572]
    );

    vk.IC = new round2Pairing.G1Point[](11);

    
      vk.IC[0] = round2Pairing.G1Point(
        11287575121868727896216245663419340438215507618657138082630290709095878053570,
        4062123897854114217433277371624064346888836693528812110205162844957598633316
      );
    
      vk.IC[1] = round2Pairing.G1Point(
        13035389915132930739510086288095289071431731016920398565146109832961186747072,
        9744929003825569870417704760015586901862315799573372957254838966746471683489
      );
    
      vk.IC[2] = round2Pairing.G1Point(
        11942132970917742222612738406478970054963140745304453735237691864022678217653,
        3731980928201335682174869747640584265296820015032735673404351683384428177624
      );
    
      vk.IC[3] = round2Pairing.G1Point(
        2362895393367232906293882249509796594756091948745968577803876471852467712179,
        14316381585512662893970222560318365500669179932441707452454936697594051573586
      );
    
      vk.IC[4] = round2Pairing.G1Point(
        12335204933419190341921110137133875214112041653706777774354152877669884596877,
        21682149522233471418248027383879978323206775691170398853285297411073590257950
      );
    
      vk.IC[5] = round2Pairing.G1Point(
        16514913685680658715485547665076945139538389583763743298244062986620556707048,
        11032425560655227060246280170015226987024789444122665976783358615219382157952
      );
    
      vk.IC[6] = round2Pairing.G1Point(
        18440072672019374090814447016212889560870809205744917712157661984427912389725,
        18000667338785918191657175971379636771731828810740788784084783262906807308443
      );
    
      vk.IC[7] = round2Pairing.G1Point(
        16399951236122040560093423058655976314758730468309209769640698788734160452447,
        11861403235318044261856991277782595388012498999661939314532317410980512617701
      );
    
      vk.IC[8] = round2Pairing.G1Point(
        667981426083080513149404245768071165216336765279373310911543999247820278672,
        17863432864618695705682309652223071177674700077100160203131204840906101673422
      );
    
      vk.IC[9] = round2Pairing.G1Point(
        15090065472285477047270932565427204313615528845717728604160946375869634377847,
        15398683389245523717209677240674056362633958878674203751559868459248673738377
      );
    
      vk.IC[10] = round2Pairing.G1Point(
        5984938166242822256276552131169779388450605346591862896029696634725013262484,
        7546935452440974902539370709443247785613290622096222318493762635785293224677
      );
    
  }

  /// @dev Verifies a Semaphore proof. Reverts with InvalidProof if the proof is invalid.
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[10] memory input
  ) public view {
    // If the values are not in the correct range, the round2Pairing contract will revert.
    Proof memory proof;
    proof.A = round2Pairing.G1Point(a[0], a[1]);
    proof.B = round2Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
    proof.C = round2Pairing.G1Point(c[0], c[1]);

    VerifyingKey memory vk = verifyingKey();

    // Compute the linear combination vk_x of inputs times IC
    if (input.length + 1 != vk.IC.length) revert round2Pairing.InvalidProof();
    round2Pairing.G1Point memory vk_x = vk.IC[0];
    for (uint i = 0; i < input.length; i++) {
      vk_x = round2Pairing.addition(vk_x, round2Pairing.scalar_mul(vk.IC[i+1], input[i]));
    }

    // Check pairing
    round2Pairing.G1Point[] memory p1 = new round2Pairing.G1Point[](4);
    round2Pairing.G2Point[] memory p2 = new round2Pairing.G2Point[](4);
    p1[0] = round2Pairing.negate(proof.A);
    p2[0] = proof.B;
    p1[1] = vk.alfa1;
    p2[1] = vk.beta2;
    p1[2] = vk_x;
    p2[2] = vk.gamma2;
    p1[3] = proof.C;
    p2[3] = vk.delta2;
    round2Pairing.pairingCheck(p1, p2);
  }
}
