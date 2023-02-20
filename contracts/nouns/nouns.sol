//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./babyjubjub/CurveBabyJubJub.sol";

enum CommitteeState {
    Init,
    Round1,
    Round2,
    Tally,
    Ended
}

contract Nouns {

    address round2_verifier;
    address vote_verifier;
    address tally_verifier;

    mapping(address => uint) public votePower;
    mapping(address => bool) public voted;
    uint[2] R;
    uint[2][3] M;
    uint[2][] DI;
    uint[] tally_cid;

    uint[2] PK;
    uint[2][][] C;

    mapping(address => uint) public committee;
    uint public n_comm;
    uint public tally_threshold;
    uint public tallied_committee;

    mapping(uint => mapping(uint => uint)) public lookup_table;

    // Generator Point
    uint public constant Gx = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    uint public constant Gy = 5472060717959818805561601436314318772137091100104008585924551046643952123905;

    constructor(
        address[] memory _verifiers,
        address[] memory _committee,
        uint _tally_threshold,
        uint VOTE_POWER_TOTAL
    ) {
        require(_verifiers.length == 3, "invalid verifiers!");
        round2_verifier = _verifiers[0];
        vote_verifier   = _verifiers[1];
        tally_verifier  = _verifiers[2];

        n_comm = _committee.length;
        for (uint i=0; i < _committee.length; ++i) {
            committee[_committee[i]] = i + 1;
        }

        tally_threshold = _tally_threshold;
        tallied_committee = 0;

        // TODO : Grained discrete lookup table
        for (uint i = 0; i < VOTE_POWER_TOTAL; i++) {
            (uint x, uint y) = CurveBabyJubJub.pointMul(Gx, Gy, i);
            lookup_table[x][y] = i;
        }
    }

    function round1(
        uint[2][] memory CI
    ) public {
        // TODO : SM check msg.sender in committee, haven't run round1
        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);

        for (uint256 t = 0; t < tally_threshold; t++) {
            require(CurveBabyJubJub.isOnCurve(CI[t][0], CI[t][1]), "invalid point");
            C[cid][t] = [CI[t][0], CI[t][1]];
        }

        // Last Committee, PK = Sum(Ci0)
        if (cid == n_comm) {
            PK = C[0][0];
            for (uint256 i = 0; i < n_comm; i++) {
                (PK[0], PK[1]) = CurveBabyJubJub.pointAdd(PK[0], PK[1], C[i][0][0], C[i][0][1]);
            }
        }
    }

    function round2(
        // ENC Data
    ) public {
        // Verify ZKP

        //
    }

    function vote(
        uint[2] calldata RI,
        uint[2][3] calldata MI
    ) public {
        require(votePower[msg.sender]>0, "invalid voter!");
        require(!voted[msg.sender], "already vote!");

        // R = R + RI
        (R[0], R[1]) = CurveBabyJubJub.pointAdd(RI[0], RI[1], R[0], R[1]);

        // M = M + MI
        if (M[0][0] == 0 && M[1][0] == 0 && M[2][0] == 0) {
            M = MI;
        } else {
            for (uint256 i = 0; i < M.length; i++) {
                (M[i][0], M[i][1]) = CurveBabyJubJub.pointAdd(M[i][0], M[i][1], MI[i][0], MI[i][1]);
            }
        }
    }

    function Lagrange_coeff(
        uint i
    ) internal returns (uint lamda) {
        lamda = 1;
        for (uint256 t = 0; t < tally_threshold; t++) {
            uint j = tally_cid[t];
            if (i == j) continue;
            lamda *= j / (j - i);
        }
    }

    function reveal(
    ) internal {
        uint[2] memory D;
        for (uint256 t = 0; t < tally_threshold; t++) {
            uint cid = tally_cid[t];
            uint lamda = Lagrange_coeff(cid);

            uint[2] memory d;
            (d[0], d[1]) = CurveBabyJubJub.pointMul(DI[t][0], DI[t][1], lamda);
            if (D[0] == 0) {
                D = d;
            } else {
                (D[0], D[1]) = CurveBabyJubJub.pointAdd(D[0], D[1], d[0], d[1]);
            }
        }

        // Jubjub point sub

        // Lookup total voting power
    }

    function tally(
        uint[2] calldata _DI
    ) public {
        // Verify ZKP ??

        uint cid = committee[msg.sender] - 1;
        require(cid >= 0);
        tally_cid.push(cid);
        DI.push(_DI);

        if (++tallied_committee == tally_threshold) {
            reveal();
        }
    }


}
