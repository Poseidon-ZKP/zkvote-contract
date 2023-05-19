//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "../interfaces/INounsDAOProxy.sol";

contract Nouns is INounsDAOProxy {
    function receiveVoteTally(uint256 proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) external override {
    }
}
