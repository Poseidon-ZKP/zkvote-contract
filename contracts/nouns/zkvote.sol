//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./babyjubjub/CurveBabyJubJub.sol";
import "hardhat/console.sol";
import "../interfaces/IDkg.sol";
import "../interfaces/INounsPrivateVoting.sol";


interface IVerifierNvote {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[15] memory input
    ) external view;
}

interface IVerifierTally {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[14] memory input
    ) external view;
}

contract ZKVote is  INounsPrivateVoting {

    uint constant babyjub_sub_order = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    IDkg public dkg;
    IVerifierNvote  nvote_verifier;
    IVerifierTally  tally_verifier;

    //
    // Voters
    //
    mapping(address => uint) public vote_power;
    uint public registered_voting_power;
    uint public max_voting_power;

    //
    // Voting state
    //

    mapping(address => bool) public voted;
    uint[2][3] public R;
    uint[2][3] public M;
    uint[2][3][] DI;
    uint[] tally_cid;
    uint public voting_weight_used;
    uint public tallied_committee;
    uint[3] public vote_totals;

    // DEBUG
    uint[] lambdas;

    //
    // DKG
    //

    // Lookup table for vote counts
    mapping(uint => mapping(uint => uint)) public lookup_table;

    event TallyComplete(/*uint indexed vote_id, */ uint yay, uint nay, uint abstain);

    // Generator Point
    uint public constant Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    uint public constant Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203;

    constructor(
        address _dkg_address, // DKG contract
        address[] memory _verifiers,
        uint _max_voting_power
    ) {
        dkg = IDkg(_dkg_address);
        // require(_verifiers.length == 3, "invalid verifiers!");
        nvote_verifier = IVerifierNvote(_verifiers[0]);
        tally_verifier = IVerifierTally(_verifiers[1]);

        // uint VOTE_POWER_TOTAL = 0;
        // for (uint i=0; i < _user.length; ++i) {
        //     votePower[_user[i]] = _votePower[i];
        //     VOTE_POWER_TOTAL += _votePower[i];
        // }

        tallied_committee = 0;
        for (uint256 i = 0; i < 3; i++) {
            R[i][0] = 0;
            R[i][1] = 1;
            M[i][0] = 0;
            M[i][1] = 1;
        }

        uint x = Gx;
        uint y = Gy;
        lookup_table[x][y] = 1;
        for (uint i = 2; i <= _max_voting_power; i++) {
            (x, y) = CurveBabyJubJub.pointAdd(x, y, Gx, Gy);
            lookup_table[x][y] = i;
        }
        max_voting_power = _max_voting_power;
    }

    function add_voter(address voter, uint voter_weight) public {
        // Temporary mechanism to define voter weights.
        require(vote_power[voter] == 0, "voter already registered");
        vote_power[voter] = voter_weight;
        registered_voting_power += voter_weight;
        require(registered_voting_power <= max_voting_power, "total voting power exceeded");
    }

    function get_voting_weight(address voter) public view returns (uint) {
        return vote_power[voter];
    }

    function vote(
        uint[2][3] calldata voter_R_i,
        uint[2][3] calldata voter_M_i,
        uint256[2] calldata proof_a,
        uint256[2][2] calldata proof_b,
        uint256[2] calldata proof_c
    ) public {

        uint vw = vote_power[msg.sender];
        require(vw > 0, "invalid voter!");
        require(!voted[msg.sender], "already vote!");
        
        (uint pk_coeff_0_0, uint pk_coeff_0_1) = dkg.get_PK();
        // Verify ZKP
        uint[15] memory inputs = [
            pk_coeff_0_0,
            pk_coeff_0_1,
            vw,
            voter_R_i[0][0],
            voter_R_i[0][1],
            voter_R_i[1][0],
            voter_R_i[1][1],
            voter_R_i[2][0],
            voter_R_i[2][1],
            voter_M_i[0][0],
            voter_M_i[0][1],
            voter_M_i[1][0],
            voter_M_i[1][1],
            voter_M_i[2][0],
            voter_M_i[2][1]
        ];

        nvote_verifier.verifyProof(proof_a, proof_b, proof_c, inputs);

        // Mark the voter as having voted
        voted[msg.sender] = true;

        // Sum the M and R values for each vote type.
        for (uint256 k = 0; k < 3; k++) {
            uint[2] storage R_k = R[k];
            uint[2] storage M_k = M[k];
            uint[2] memory R_i_k = voter_R_i[k];
            uint[2] memory M_i_k = voter_M_i[k];
            // R_k = R_k + R_{i,k}
            (R_k[0], R_k[1]) = CurveBabyJubJub.pointAdd(
                R_k[0], R_k[1], R_i_k[0], R_i_k[1]);
            // M_k = M_k + M_{i,k}
            (M_k[0], M_k[1]) = CurveBabyJubJub.pointAdd(M_k[0], M_k[1], M_i_k[0], M_i_k[1]);
        }

        voting_weight_used += vw;
    }

    function get_R() public view returns (uint[2][3] memory) {
        return R;
    }

    function get_M() public view returns (uint[2][3] memory) {
        return M;
    }

    function has_voted(address voter) public view returns(bool) {
        return voted[voter];
    }

    // function pointSub(uint256 _x1, uint256 _y1, uint256 _x2, uint256 _y2) public view returns (uint256 x3, uint256 y3) {
    //     return CurveBabyJubJub.pointSub(_x1, _y1, _x2, _y2);
    // }

    function tally(
        uint[2][3] calldata DI_,
        uint[2] calldata proof_a,
        uint[2][2] calldata proof_b,
        uint[2] calldata proof_c
    ) public {
        uint cid = dkg.get_committee_id_from_address(msg.sender);
        require((0 < cid) && (cid <= dkg.n_comm()), "invalid participant id");
        require(tally_cid.length < dkg.threshold(), "votes already tallied");

        (uint PK_i_0, uint PK_i_1) = dkg.get_PK_for(cid);

        uint[14] memory inputs = [
            PK_i_0,
            PK_i_1,
            // R[0] ~ R[2]
            R[0][0],
            R[0][1],
            R[1][0],
            R[1][1],
            R[2][0],
            R[2][1],
            // D[0] ~ D[2]
            DI_[0][0],
            DI_[0][1],
            DI_[1][0],
            DI_[1][1],
            DI_[2][0],
            DI_[2][1]
        ];

        tally_verifier.verifyProof(proof_a, proof_b, proof_c, inputs);

        tally_cid.push(cid);
        DI.push(DI_);

        if (++tallied_committee == dkg.threshold()) {
            reveal();
        }
    }

    function Lagrange_coeff(uint i) internal view returns (uint lamda) {

        // For denominator we may have -ve factors. Track the number of
        // +ve / -ve factors and perform modulo at the end.

        // Use x -> x^{r-2} to compute x^{-1} and divide by the denominator.

        uint numerator = 1;
        uint denominator = 1;
        int denom_sign = 1;

        for (uint256 t = 0; t < dkg.threshold(); t++) {
            uint j = tally_cid[t];
            if (i == j) continue;
            numerator *= j;
            int denom_factor = int(j) - int(i);
            if (denom_factor < 0) {
                denom_factor = -denom_factor;
                denom_sign *= -1;
            }
            denominator *= uint(denom_factor);

            // lamda *= (j / (j - i));
        }

        if (denom_sign == -1) {
            denominator = babyjub_sub_order - denominator;
        }
        uint denominator_inv = CurveBabyJubJub.expmod(
            denominator, babyjub_sub_order - 2, babyjub_sub_order);
        return mulmod(numerator, denominator_inv, babyjub_sub_order);
    }

    function reveal() internal {
        // For each k=0,1,2, we must compute:
        //
        //   sum_{i \in I} \lambda_i D_{i,k}
        //
        // where I is the set of IDs we have submissions for.
        //
        // \lambda_i is computed as:
        //
        //   \lambda_i
        //     = \prod_{j \in I, j \neq i} j / (j-i)
        //     = P / (i \prod_j (j-i))
        //
        // if P is pre-computed as:
        //
        //   P = \prod_{i \in I} i

        uint[2][3] memory D;
        D[0][0] = 0;
        D[0][1] = 1;
        D[1][0] = 0;
        D[1][1] = 1;
        D[2][0] = 0;
        D[2][1] = 1;

        for (uint256 i = 0; i < dkg.threshold(); i++) {
            uint cid = tally_cid[i];
            uint[2][3] storage D_t = DI[i];

            uint lambda = Lagrange_coeff(cid);
            // DEBUG:
            lambdas.push(lambda);
            require(lambda >= 0, "invalid lambda");

            for (uint k = 0 ; k < 3 ; ++k) {

                uint[2] storage D_t_k = D_t[k];
                (uint x, uint y) = CurveBabyJubJub.pointMul(D_t_k[0], D_t_k[1], lambda);
                (D[k][0], D[k][1]) = CurveBabyJubJub.pointAdd(D[k][0], D[k][1], x, y);

                // if (lamda < 0) {
                //     (d[0], d[1]) = CurveBabyJubJub.pointMul(DI[t][0], DI[t][1], uint(0 - lamda));
                //     (D[0], D[1]) = CurveBabyJubJub.pointSub(D[0], D[1], d[0], d[1]);
                // } else if (lamda > 0) {
                //     (d[0], d[1]) = CurveBabyJubJub.pointMul(DI[t][0], DI[t][1], uint(lamda));
                //     (D[0], D[1]) = CurveBabyJubJub.pointAdd(D[0], D[1], d[0], d[1]);
                // }
            }
        }

        for (uint256 k = 0; k < 3; k++) {
            uint[2] memory VG;
            (VG[0], VG[1]) = CurveBabyJubJub.pointSub(M[k][0], M[k][1], D[k][0], D[k][1]);
            vote_totals[k] = lookup_table[VG[0]][VG[1]];
        }

        emit TallyComplete(vote_totals[0], vote_totals[1], vote_totals[2]);
    }

    function get_vote_totals() public view returns (uint[3] memory) {
        return vote_totals;
    }

    function get_tally_committee_debug() public view returns(uint[] memory, uint[] memory, uint[2][3][] memory) {
        return (tally_cid, lambdas, DI);
    }