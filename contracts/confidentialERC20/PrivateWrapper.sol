// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./PrivateERC20.sol";
import "./BalanceRegistry.sol";

contract PrivateWrapper is PrivateERC20 {
    using SafeERC20 for ERC20;

    event Wrap(uint256 amount);
    event Unwrap(uint256 amount, address to);

    ERC20 public immutable baseToken;

    constructor(ERC20 _baseToken, address _multicall, ConfidentialBalanceRegistry balanceRegistry) PrivateERC20(PrivateERC20Config(
        true,
        string(abi.encodePacked("p", _baseToken.name())),
        string(abi.encodePacked("p", _baseToken.symbol())),
        _baseToken.decimals()
    ), _multicall, balanceRegistry) {
        baseToken = _baseToken;
    }

    function unwrap(uint256 amount, address to) public {
        require(_balances[msg.sender] >= amount, "Insufficient funds");

        _burn(msg.sender, amount);
        baseToken.safeTransfer(to, amount);

        emit Unwrap(amount, to);
    }

    function wrap(uint256 amount, address to) public {
        uint256 balanceBefore = baseToken.balanceOf(address(this));
        baseToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 balanceAfter = baseToken.balanceOf(address(this));
        require((balanceAfter - balanceBefore) == amount, "Imbalanced amounts");

        _mint(to, amount);
        emit Wrap(amount);
    }
}