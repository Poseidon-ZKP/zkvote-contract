//SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

interface IVerifierRound2 {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[12] memory input
    ) external view;
}
