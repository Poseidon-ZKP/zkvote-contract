//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./babyjubjub/CurveBabyJubJub.sol";

contract Nouns {

    address round2_verifier;
    address vote_verifier;
    address tally_verifier;

    mapping(address => uint) public votePower;
    mapping(address => bool) public voted;
    uint[2] R;

    uint[2] PK;
    uint[][][2] C;

    mapping(address => uint) public committee;
    uint public tally_threshold;
    uint public tallied_committee;

    mapping(uint => uint) public lookup_table;

    constructor(
        address[] memory _verifiers,
        address[] memory _committee,
        uint _tally_threshold,
        uint MAX_USER_NUM
    ) {
        require(_verifiler.length == 3, "invalid verifiers!");
        round2_verifier = _verifiers[0];
        vote_verifier   = _verifiers[1];
        tally_verifier  = _verifiers[2];

        for (uint i=0; i < _committee.length; ++i) {
            committee[_committee[i]] = i;
        }

        tally_threshold = _tally_threshold;
        tallied_committee = 0;

        // setup lookup table : jubjub sclar mul
    }

    function round1(
        uint[][2] memory C
    ) public {
        // ZKP ?

        // Last Committee, PK = Sum(Ci0)
    }

    function round2() public {
    }

    function vote(
        uint[2] RI,
        uint[][2] memory MI,
    ) public {
        require(votePower[msg.sender]>0, "invalid voter!");
        require(!voted[msg.sender], "already vote!");

        // R = R + RI, Jubjub point add

        // M = M + MI, Jubjub point add

        // Jubjub point add
    }

    function reveal(
        uint[2] DI
    ) internal {
        // Jubjub scalar mul

        // Jubjub point sub

        // Lookup total voting power
    }

    function tally(
        // D
    ) public {
        // verify ZKP

        if (++tallied_committee == tally_threshold) {
            reveal();
        }
    }


}
