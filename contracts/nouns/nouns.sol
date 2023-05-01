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
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[10] memory input
        // bytes memory proof,
        // uint[] memory pubSignals
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

    //
    // Voting
    //

    mapping(address => uint) public votePower;
    mapping(address => bool) public voted;
    uint[3] public voteStats;
    uint[2] public R;
    uint[2][3] public M;
    uint[2][] DI;
    uint[] tally_cid;

    //
    // Committee
    //

    uint public n_comm;
    uint public tally_threshold;
    uint public tallied_committee;
    mapping(address => uint) public committee;

    //
    // DKG
    //

    // Final summed polynomial coefficients.
    // After round 1, PK[0] = final committee PK.
    uint[2][] public PK_coeffs;

    // Round 1

    mapping(uint => uint[2][]) round1_C_coeffs;
    mapping(address => bool) public round1_done;
    uint round1_received;

    // Round 2
    mapping(uint => mapping(uint => bool)) public round2_shares_received;
    uint round2_num_shares;
    // mapping(uint => mapping(uint => uint)) public enc_sk_shares;
    // mapping(uint => mapping(uint => uint[2])) public enc_eph_PK;

    // Lookup table for vote counts
    mapping(uint => mapping(uint => uint)) public lookup_table;

    // Events
    event Round1Complete();
    event Round2Share(uint indexed recip_id, uint sender_id, uint enc_sk_share, uint[2] enc_eph_PK);

    // Generator Point
    uint public constant Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    uint public constant Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203;

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

        uint x = Gx;
        uint y = Gy;
        lookup_table[x][y] = 1;
        for (uint i = 2; i <= VOTE_POWER_TOTAL; i++) {
            (x, y) = CurveBabyJubJub.pointAdd(x, y, Gx, Gy);
            lookup_table[x][y] = i;
        }
    }

    function PK() public view returns (uint256, uint256) {
        require(round1_complete(), "round1 is not complete.");
        return (PK_coeffs[0][0], PK_coeffs[0][1]);
    }

    function PK_coefficients() public view returns (uint[2][] memory) {
        require(round1_complete(), "round1 is not complete.");
        return PK_coeffs;
    }

    function round1(
        uint[2][] memory C_coeffs
    ) public {
        require(round1_received < n_comm, "round 1 already complete");
        require(!round1_done[msg.sender], "user already participated in round 1!");
        require(C_coeffs.length == tally_threshold, "round 1 already done!");

        uint cid = committee[msg.sender];
        require(cid > 0);

        for (uint256 t = 0; t < tally_threshold; t++) {
            require(CurveBabyJubJub.isOnCurve(C_coeffs[t][0], C_coeffs[t][1]), "invalid point");
        }
        round1_C_coeffs[cid] = C_coeffs;

        // First set of points is just written to the PK shares.  Subsequent
        // points are added.
        if (round1_received == 0) {
            PK_coeffs = C_coeffs;
        } else {
            for (uint256 t = 0; t < tally_threshold; t++) {
                (uint256 x, uint256 y) = CurveBabyJubJub.pointAdd(
                    PK_coeffs[t][0], PK_coeffs[t][1], C_coeffs[t][0], C_coeffs[t][1]);
                PK_coeffs[t] = [x, y];
            }
        }

        // Mark round 1 as done for this participant.
        round1_done[msg.sender] = true;
        round1_received++;

        // Emit an event when all participants have submitted, and round 1 is
        // complete.
        if (round1_received == n_comm) {
            emit Round1Complete();
        }
    }

    function round1_complete() public view returns (bool) {
        return round1_received == n_comm;
    }

    function get_round1_PK_for(uint participant_id) public view returns (uint, uint) {
        require(
            (0 < participant_id) && (participant_id <= n_comm),
            "invalid participant_id");
        uint[2] storage r1_p_PK = round1_C_coeffs[participant_id][0];
        return (r1_p_PK[0], r1_p_PK[1]);
    }

    function round2(
        uint recip_id,
        uint enc,
        uint[2] calldata eph_pk,
        // uint[2] calldata PK_i_l,
        uint256[2] memory proof_a,
        uint256[2][2] memory proof_b,
        uint256[2] memory proof_c
        // bytes calldata proof
    ) public {
        require(
            (0 < recip_id) && (recip_id <= n_comm),
            "unexpected validator id");
        uint sender_id = committee[msg.sender];
        require(sender_id > 0, "invalid sender id");
        require(
            round2_shares_received[sender_id][recip_id] == false,
            "round2 sender-receiver pair already submitted");
        require(sender_id != recip_id, "cannot submit share for self");

        uint[2] memory recip_pk = round1_C_coeffs[recip_id][0];

        // Num public inputs should be 1 + 2 + 1 + 2 + 2*tally_threshold
        uint num_pub_inputs = 6 + (2 * tally_threshold);
        require(10 == num_pub_inputs, "invalid public input length");
        uint[10] memory pub;
        pub[0] = recip_id;
        pub[1] = recip_pk[0];
        pub[2] = recip_pk[1];
        pub[3] = enc;
        pub[4] = eph_pk[0];
        pub[5] = eph_pk[1];
        // Copy the C_coeffs at the end of the public inputs.
        uint dest_idx = 6;
        for (uint i = 0 ; i < tally_threshold ; ++i) {
            pub[dest_idx++] = round1_C_coeffs[sender_id][i][0];
            pub[dest_idx++] = round1_C_coeffs[sender_id][i][1];
        }

        round2_verifier.verifyProof(proof_a, proof_b, proof_c, pub);
        // round2_verifier.verifyProof(proof, pub);

        round2_shares_received[sender_id][recip_id] = true;
        ++round2_num_shares;
        emit Round2Share(recip_id, sender_id, enc, eph_pk);
    }

    function round2_share_received(uint sender_id, uint recip_id) public view returns (bool) {
        require((0 < sender_id) && (sender_id <= n_comm), "invalid sender_id");
        require((0 < recip_id) && (recip_id <= n_comm), "invalid recip_id");
        return round2_shares_received[sender_id][recip_id];
    }

    function round2_complete() public view returns (bool) {
        return round2_num_shares == n_comm * (n_comm - 1);
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
              PK_coeffs[0][0], PK_coeffs[0][1], votePower[msg.sender]]
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
