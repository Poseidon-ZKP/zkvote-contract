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
      [9016729513612598367916467393283175068002414380711346840449107828424741924530, 17639052453519983923561724391260447687970540154377142515013762250301889662985],
      [3771097704987093284347117724630385533545135898148378061789702513728441256774, 13716491479325759832740752657844378004782041979063079957294462437376571695533]
    );

    vk.IC = new round2Pairing.G1Point[](11);

    
      vk.IC[0] = round2Pairing.G1Point(
        2959952255769742731393900795950193266625791990514292588611918690285846235492,
        125605417047336724635083169510246775426881797293790177968758658593433935043
      );
    
      vk.IC[1] = round2Pairing.G1Point(
        6803249557059076517963226303405482984048223434230608231853241783059768394517,
        15145841049268079628005403825330806828230236257075467965413013567858640486303
      );
    
      vk.IC[2] = round2Pairing.G1Point(
        2654971883938506484504562245278268796955713756251877389327204716683121837584,
        411236042995395476514322427929751662327078175019240392275623451442299800977
      );
    
      vk.IC[3] = round2Pairing.G1Point(
        3263103759513406076721578657393527556389020294801742343405368189109355651217,
        10565825501298671283447582859756372919283262660724642472603115312382185435114
      );
    
      vk.IC[4] = round2Pairing.G1Point(
        11784978224805045110906844804365526209295282714753449805119894153459394544529,
        11966933190121786401710694947222587461747918912263444421000672347200192143325
      );
    
      vk.IC[5] = round2Pairing.G1Point(
        19714306678175188883836209716533695424909965542715534025731062086033972269925,
        4553840148441743201825715258703453913864780232569359013793826882815448057259
      );
    
      vk.IC[6] = round2Pairing.G1Point(
        2160949153455203555530878730015048695099859883558136192754395929876566444887,
        7396040568814221735353921117027660290575889584754874618768731250685421265384
      );
    
      vk.IC[7] = round2Pairing.G1Point(
        9751577455592775751579034092340943221959147493089591512669467454795153080011,
        4570308761402965447386654349731925693407593412558397948281665887366309821680
      );
    
      vk.IC[8] = round2Pairing.G1Point(
        8608831584521812165546213064594714003504849409306952695801224374160141200963,
        14916754818325141031922693768934708339359545546673573015701627872254631549749
      );
    
      vk.IC[9] = round2Pairing.G1Point(
        3210636855029322364270429766359817751519657121273360813098748216324763021531,
        21325279953994836462810916248894866666712575299505558806223410339911894717547
      );
    
      vk.IC[10] = round2Pairing.G1Point(
        16993405328677630973082028541179933471480960097121477678175049790244829977783,
        21810221317050185583271403465547940554775649540472239694538974316916329748272
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
