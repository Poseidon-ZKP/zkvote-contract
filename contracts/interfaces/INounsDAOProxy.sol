// SPDX-License-Identifier: MIT
/// @title Interface for NounsDAOProxy

pragma solidity >=0.8.4;

interface INounsDAOProxy {
  function receiveVoteTally(uint256 proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) external;

  function max_voting_power() external returns (uint256);
}
