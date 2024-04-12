// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import 'contracts/confidentialERC20/PrivateERC20.sol';

import "hardhat/console.sol";

contract MockPrivateToken is PrivateERC20 {
    // struct PrivateERC20Config {
    //     bool totalSupplyVisible;
    //     string name;
    //     string symbol;
    //     uint8 decimals;
    // }
    constructor(
        PrivateERC20Config memory _config, 
        address _multicall, 
        ConfidentialBalanceRegistry _balanceRegistry
    ) PrivateERC20(
        _config, 
        _multicall, 
        _balanceRegistry
    ) {}

    function mint(address sender, uint256 amount) external {
        console.log("log in private token contract: mint to ", sender, "amount = ", amount);
        _mint(sender, amount);
    }

    // function decimals() public view virtual override returns (uint8) {
    //     return 6;
    // }
}
