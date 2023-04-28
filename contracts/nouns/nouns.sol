//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./babyjubjub/CurveBabyJubJub.sol";
import "hardhat/console.sol";

enum CommitteeState {
    Init,
    Round1,
    Round2,
    Tally,
    Ended
}

interface IVerifierRound2 {
    function verifyProof(
        bytes memory proof,
        uint[] memory pubSignals
    ) external view;
}

interface IVerifierNvote {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[11] memory input
    ) external view;
}

contract Nouns {

    IVerifierRound2 round2_verifier;
    IVerifierNvote  nvote_verifier;
    address tally_verifier;

    mapping(address => uint) public votePower;
    mapping(address => bool) public voted;
    uint[3] public voteStats;
    uint[2] public R;
    uint[2][3] public M;
    uint[2][] DI;
    uint[] tally_cid;

    // Committee
    uint public n_comm;
    uint public tally_threshold;
    uint public tallied_committee;
    mapping(address => uint) public committee;

    // DKG
    uint[2][] public PK_shares;
    mapping(uint => uint[2][]) C;
    mapping(address => bool) public round1_done;
    uint round1_total;

    mapping(uint => mapping(uint => uint)) public ENC;
    mapping(uint => mapping(uint => mapping(uint => uint))) public KB;

    mapping(uint => mapping(uint => uint)) public lookup_table;

    // Generator Point
    uint public constant Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    uint public constant Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;

    constructor(
        address[] memory _verifiers,
        address[] memory _committee,
        address[] memory _user,
        uint[] memory _votePower,
        uint _tally_threshold
    ) {
        // require(_verifiers.length == 3, "invalid verifiers!");
        round2_verifier = IVerifierRound2(_verifiers[0]);
        nvote_verifier   = IVerifierNvote(_verifiers[1]);
        // tally_verifier  = _verifiers[2];

        n_comm = _committee.length;
        for (uint i=0; i < _committee.length; ++i) {
            committee[_committee[i]] = i + 1;
        }

        uint VOTE_POWER_TOTAL = 0;
        for (uint i=0; i < _user.length; ++i) {
            votePower[_user[i]] = _votePower[i];
            VOTE_POWER_TOTAL += _votePower[i];
        }

        tally_threshold = _tally_threshold;
        tallied_committee = 0;
        R[0] = 0;
        R[1] = 1;
        for (uint256 i = 0; i < 3; i++) {
            M[i][0] = 0;
            M[i][1] = 1;
        }

        for (uint i = 1; i <= VOTE_POWER_TOTAL; i++) {
            (uint x, uint y) = CurveBabyJubJub.pointMul(Gx, Gy, i);
            lookup_table[x][y] = i;
        }
    }

    function PK() public view returns (uint256, uint256) {
        return (PK_shares[0][0], PK_shares[0][1]);
    }

    function round1(
        uint[2][] memory CI
    ) public {
        require(round1_total < n_comm, "round 1 already complete");
        require(!round1_done[msg.sender], "user already participated in round 1!");
        require(CI.length == tally_threshold, "round 1 already done!");

        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);

        for (uint256 t = 0; t < tally_threshold; t++) {
            require(CurveBabyJubJub.isOnCurve(CI[t][0], CI[t][1]), "invalid point");
        }
        C[cid] = CI;

        // First set of points is just written to the PK shares.  Subsequent
        // points are added.
        if (round1_total == 0) {
            PK_shares = CI;
        } else {
            for (uint256 t = 0; t < tally_threshold; t++) {
                (uint256 x, uint256 y) = CurveBabyJubJub.pointAdd(
                    PK_shares[t][0], PK_shares[t][1], CI[t][0], CI[t][1]);
                PK_shares[t] = [x, y];
                // PK_shares[t][0] = x;
                // PK_shares[t][1] = y;
            }
        }

        round1_done[msg.sender] = true;
        round1_total++;

        // // Last Committee, PK = Sum(Ci0)
        if (round1_total == n_comm) {
        //     PK = [C[0][0][0], C[0][0][1]];
        //     for (uint256 i = 1; i < n_comm; i++) {
        //         (PK[0], PK[1]) = CurveBabyJubJub.pointAdd(PK[0], PK[1], C[i][0][0], C[i][0][1]);
        //     }

        }
    }

    function round1_complete() public view returns (bool) {
        return round1_total == n_comm;
    }

    function round2(
        uint l,
        uint enc,
        uint[2] calldata kb,
        uint[2] calldata out,
        bytes calldata proof
    ) public {
        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);

        uint[] memory pub = new uint[](12);
        pub[0] = out[0];
        pub[1] = out[1];
        pub[2] = enc;
        pub[3] = kb[0];
        pub[4] = kb[1];
        pub[5] = l;
        pub[6] = C[cid][0][0];
        pub[7] = C[cid][0][1];
        pub[8] = C[cid][1][0];
        pub[9] = C[cid][1][1];
        pub[10] = C[l][0][0];
        pub[11] = C[l][0][1];

        round2_verifier.verifyProof(proof, pub);

        ENC[cid][l] = enc;
        KB[cid][l][0] = kb[0];
        KB[cid][l][1] = kb[1];
    }

    function vote(
        uint[2] calldata RI,
        uint[2][3] calldata MI,
        uint[8] calldata proof
    ) public {
        require(votePower[msg.sender]>0, "invalid voter!");
        require(!voted[msg.sender], "already vote!");
        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);

        // R = R + RI
        (R[0], R[1]) = CurveBabyJubJub.pointAdd(RI[0], RI[1], R[0], R[1]);

        // M = M + MI
        for (uint256 i = 0; i < 3; i++) {
            (M[i][0], M[i][1]) = CurveBabyJubJub.pointAdd(M[i][0], M[i][1], MI[i][0], MI[i][1]);
        }

        // Verify ZKP
        nvote_verifier.verifyProof(
            [proof[0], proof[1]],
            [[proof[2], proof[3]], [proof[4], proof[5]]],
            [proof[6], proof[7]],
            [ RI[0], RI[1], MI[0][0], MI[0][1], MI[1][0], MI[1][1], MI[2][0], MI[2][1],
              PK_shares[0][0], PK_shares[0][1], votePower[msg.sender]]
        );
    }

    function pointSub(uint256 _x1, uint256 _y1, uint256 _x2, uint256 _y2) public view returns (uint256 x3, uint256 y3) {
        return CurveBabyJubJub.pointSub(_x1, _y1, _x2, _y2);
    }

    function Lagrange_coeff(
        int i
    ) internal view returns (int lamda) {
        lamda = 1;
        for (uint256 t = 0; t < tally_threshold; t++) {
            int j = int(tally_cid[t]);
            if (i == j) continue;
            lamda *= (j / (j - i));
        }
    }

    function reveal(
    ) internal {
        uint[2] memory D;
        D[0] = 0;
        D[1] = 1;

        for (uint256 t = 0; t < tally_threshold; t++) {
            uint cid = tally_cid[t];
            int lamda = Lagrange_coeff(int(cid));

            uint[2] memory d;
            if (lamda < 0) {
                (d[0], d[1]) = CurveBabyJubJub.pointMul(DI[t][0], DI[t][1], uint(0 - lamda));
                (D[0], D[1]) = CurveBabyJubJub.pointSub(D[0], D[1], d[0], d[1]);
            } else if (lamda > 0) {
                (d[0], d[1]) = CurveBabyJubJub.pointMul(DI[t][0], DI[t][1], uint(lamda));
                (D[0], D[1]) = CurveBabyJubJub.pointAdd(D[0], D[1], d[0], d[1]);
            }
        }

        for (uint256 i = 0; i < 3; i++) {
            uint[2] memory VG;
            (VG[0], VG[1]) = CurveBabyJubJub.pointSub(M[i][0], M[i][1], D[0], D[1]);
            voteStats[i] = lookup_table[VG[0]][VG[1]];
        }
    }

    function tally(
        uint[2] calldata _DI
    ) public {
        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);

        tally_cid.push(cid);
        DI.push(_DI);

        if (++tallied_committee == tally_threshold) {
            reveal();
        }
    }
}
