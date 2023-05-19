// SPDX-License-Identifier: MIT
/// @title Interface for NounsPrivateVoting

pragma solidity >=0.8.4;

interface INounsPrivateVoting {
  function setupVote(
        uint256 proposalId, 
        uint256 endBlock, 
        address governanceProxyContract
  ) external;
  function castPrivateVote(
        uint256 proposalId, 
        uint256 votingWeight,
        uint[2][3] calldata voter_R_i, 
        uint[2][3] calldata voter_M_i,
        uint256[2] calldata proof_a,
        uint256[2][2] calldata proof_b,
        uint256[2] calldata proof_c
  ) external;
}
