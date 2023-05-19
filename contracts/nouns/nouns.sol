//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/INounsDAOProxy.sol";
import "../interfaces/INounsPrivateVoting.sol";

contract Nouns is INounsDAOProxy {
    INounsPrivateVoting zkvote;
    struct VoteTally {
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
    }
    mapping (uint256 => VoteTally) public voteTallies;

    //
    // Voters
    //
    mapping(address => uint) public vote_power;
    uint public registered_voting_power;
    uint public max_voting_power;

    constructor (address _zkvote, uint _max_voting_power) {
        zkvote = INounsPrivateVoting(_zkvote);
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

    function receiveVoteTally(uint256 proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) public onlyZKVote override {
        voteTallies[proposalId] = VoteTally(forVotes, againstVotes, abstainVotes);
    }

    function castPrivateVote(
        uint256 proposalId, 
        uint[2][3] calldata voter_R_i, 
        uint[2][3] calldata voter_M_i,
        uint256[2] calldata proof_a,
        uint256[2][2] calldata proof_b,
        uint256[2] calldata proof_c
    ) public {
        uint256 votingWeight = get_voting_weight(msg.sender);
        zkvote.castPrivateVote(proposalId, votingWeight, voter_R_i, voter_M_i, proof_a, proof_b, proof_c);
    }

    modifier onlyZKVote() {
        require(msg.sender == address(zkvote), "Nouns::onlyZKVote: Only ZKVote can call this function.");
        _;
    }
}
