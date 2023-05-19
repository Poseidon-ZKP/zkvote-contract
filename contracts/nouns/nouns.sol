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

    constructor (address _zkvote) {
        zkvote = INounsPrivateVoting(_zkvote);
    }

    function receiveVoteTally(uint256 proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) public onlyZKVote override {
        voteTallies[proposalId] = VoteTally(forVotes, againstVotes, abstainVotes);
    }

    modifier onlyZKVote() {
        require(msg.sender == address(zkvote), "Nouns::onlyZKVote: Only ZKVote can call this function.");
        _;
    }
}
