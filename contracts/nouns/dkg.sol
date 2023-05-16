//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "./babyjubjub/CurveBabyJubJub.sol";
import "../interfaces/IVerifierRound2.sol";
import "../interfaces/IDkg.sol";

contract DKG is IDkg {
        uint constant babyjub_sub_order = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    IVerifierRound2 round2_verifier;

    //
    // Committee configuration
    //

    uint public n_comm;
    uint public tally_threshold;
    mapping(address => uint) public committee_ids;

    //
    // DKG
    //

    // Final summed polynomial coefficients.
    // After round 1, PK[0] = final committee PK.
    uint[2][] public PK_coeffs;
    uint[2][] public PK_shares;

    // Round 1

    mapping(uint => uint[2][]) round1_C_coeffs;
    mapping(address => bool) public round1_done;
    uint round1_received;

    // Round 2
    mapping(uint => mapping(uint => bool)) public round2_shares_received;
    uint round2_num_shares;

    // Events
    event Round1Complete();
    event Round2Share(uint indexed recip_id, uint sender_id, uint enc_sk_share, uint[2] enc_eph_PK);

    constructor(
        address _round2_verifier,
        address[] memory _committee
    ) {
        // require(_verifiers.length == 3, "invalid verifiers!");
        round2_verifier = IVerifierRound2(_round2_verifier);

        n_comm = _committee.length;
        PK_shares = new uint[2][](n_comm + 1);
        for (uint i=0; i < _committee.length; ++i) {
            uint id = i + 1;
            committee_ids[_committee[i]] = id;
            PK_shares[id] = [0,1];
        }
    }

    function get_PK() public view returns (uint256, uint256) {
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

        uint sender_id = committee_ids[msg.sender];
        require((0 < sender_id) && (sender_id <= n_comm));

        for (uint256 t = 0; t < tally_threshold; t++) {
            require(CurveBabyJubJub.isOnCurve(C_coeffs[t][0], C_coeffs[t][1]), "invalid point");
        }
        round1_C_coeffs[sender_id] = C_coeffs;

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

            // TODO: state cleanup to save some gas?
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
        uint[2] calldata PK_i_l,
        uint256[2] calldata proof_a,
        uint256[2][2] calldata proof_b,
        uint256[2] calldata proof_c
        // bytes calldata proof
    ) public {
        require(
            (0 < recip_id) && (recip_id <= n_comm),
            "unexpected validator id");
        uint sender_id = committee_ids[msg.sender];
        require(sender_id > 0, "invalid sender id");
        require(
            round2_shares_received[sender_id][recip_id] == false,
            "round2 sender-receiver pair already submitted");

        uint[2] memory recip_pk = round1_C_coeffs[recip_id][0];

        // Num public inputs should be 1 + 2 + 1 + 2 + 2 + 2*tally_threshold
        uint num_pub_inputs = 8 + (2 * tally_threshold);
        require(12 == num_pub_inputs, "invalid public input length");
        uint[12] memory pub;
        pub[0] = recip_id;
        pub[1] = recip_pk[0];
        pub[2] = recip_pk[1];
        pub[3] = PK_i_l[0];
        pub[4] = PK_i_l[1];
        pub[5] = enc;
        pub[6] = eph_pk[0];
        pub[7] = eph_pk[1];
        // Copy the C_coeffs at the end of the public inputs.
        uint dest_idx = 8;
        for (uint i = 0 ; i < tally_threshold ; ++i) {
            pub[dest_idx++] = round1_C_coeffs[sender_id][i][0];
            pub[dest_idx++] = round1_C_coeffs[sender_id][i][1];
        }

        round2_verifier.verifyProof(proof_a, proof_b, proof_c, pub);
        // round2_verifier.verifyProof(proof, pub);

        uint[2] storage recip_pk_share = PK_shares[recip_id];
        (recip_pk_share[0], recip_pk_share[1]) = CurveBabyJubJub.pointAdd(
            recip_pk_share[0], recip_pk_share[1], PK_i_l[0], PK_i_l[1]);

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
        return round2_num_shares == n_comm * n_comm;
    }

    function get_PK_for(uint participant_id) public view returns(uint, uint) {
        require(round2_complete(), "round2 not complete");
        require((0 < participant_id) && (participant_id <= n_comm), "invalid participant_id");
        uint[2] storage pk_share = PK_shares[participant_id];
        return (pk_share[0], pk_share[1]);
    }

    function get_committee_id_from_address(address addr) public view returns (uint) {
        return committee_ids[addr];
    }
}