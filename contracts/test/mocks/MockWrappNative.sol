// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MockWrappedNative is ERC20, ERC20Burnable {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    constructor() ERC20("MockWrappedNative", "wNATIVE") {}

    function mint(address sender, uint256 amount) external {
        _mint(sender, amount);
    }

    function deposit() external payable {
        _deposit();
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);
    }

    function _deposit() internal {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function sudoApprove(address _from, address _to, uint256 _amount) external {
        _approve(_from, _to, _amount);
    }
}
