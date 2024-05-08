// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWrappedETH is ERC20 {
    constructor() ERC20("MWE", "MockWrappedETH") {}

    function mint(address sender, uint256 amount) external {
        _mint(sender, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
