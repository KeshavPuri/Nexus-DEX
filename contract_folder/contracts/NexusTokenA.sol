// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NexusTokenA is ERC20 {
    constructor() ERC20("Nexus Token A", "NEXA") {
        // Mint 1,000,000 tokens to the person who deploys the contract
        _mint(msg.sender, 1000000 * 10**18);
    }
}