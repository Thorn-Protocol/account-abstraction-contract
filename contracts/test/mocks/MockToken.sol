// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "hardhat/console.sol";

contract MockToken is ERC20 {
    constructor() ERC20("TST", "MockToken") {}

    function mint(address sender, uint256 amount) external {
        console.log("log in contract: mint to ", sender, "amount = ", amount);
        _mint(sender, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
