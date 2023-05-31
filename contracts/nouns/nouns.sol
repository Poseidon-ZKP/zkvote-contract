//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/IDAOProxy.sol";
import "../interfaces/IZKVote.sol";

contract Nouns is IDAOProxy {
    IZKVote public zkVote;
    struct VoteTally {
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
    }
    mapping (uint256 => VoteTally) public voteTallies;

    //
    // Voters
    //
    mapping(uint => mapping(address => uint)) public vote_power;
    mapping (uint256 => uint256) public registered_voting_power;
    mapping(uint256 => mapping (address => bool)) public voted;

    constructor (address _zkVote) {
        zkVote = IZKVote(_zkVote);
    }

    function add_voter(uint proposalId, address voter, uint voter_weight) public {
        // Temporary mechanism to define voter weights.
        require(vote_power[proposalId][voter] == 0, "voter already registered");
        vote_power[proposalId][voter] = voter_weight;
        registered_voting_power[proposalId] += voter_weight;
        require(registered_voting_power[proposalId] <= zkVote.maxTotalVotingWeight(), "total voting power exceeded");
    }

    function get_voting_weight(uint256 proposalId, address voter) public view returns (uint) {
        return vote_power[proposalId][voter];
    }

    function receiveVoteTally(uint256 proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) public onlyZKVote override {
        voteTallies[proposalId] = VoteTally(forVotes, againstVotes, abstainVotes);
    }

    function setupVote(
        uint256 proposalId, 
        uint256 endBlock
    ) public {
        zkVote.setupVote(proposalId, endBlock);
    }

    function castPrivateVote(
        uint256 proposalId, 
        uint[2][3] calldata voter_R_i, 
        uint[2][3] calldata voter_M_i,
        uint256[2] calldata proof_a,
        uint256[2][2] calldata proof_b,
        uint256[2] calldata proof_c
    ) public {
        address voter = msg.sender;
        require(!voted[proposalId][voter], "already voted!");
        uint256 votingWeight = get_voting_weight(proposalId, voter);
        require(votingWeight > 0, "voter has 0 weight");
        zkVote.castPrivateVote(proposalId, votingWeight, voter_R_i, voter_M_i, proof_a, proof_b, proof_c);
        // Mark the voter as having voted
        voted[proposalId][voter] = true;
    }


    function has_voted(uint256 proposalId, address voter) public view returns(bool) {
        return voted[proposalId][voter];
    }

    modifier onlyZKVote() {
        require(msg.sender == address(zkVote), "Nouns::onlyZKVote: Only ZKVote can call this function.");
        _;
    }
}
