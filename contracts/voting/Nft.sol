// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract voteNFT is ERC721 {
    uint constant MAX_MINT = 10000;
    uint public mint_id = 0;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {

    }

    function mint() public {
        require(mint_id < MAX_MINT, "mint_id >= MAX_MINT");
        _mint(msg.sender, mint_id++);
    }
}