// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrossChainERC20 is IERC20 {
    struct CrossChainERC20Config {
        string name;
        string symbol;
        uint8 decimals;

        uint64 originalChainId;
        address originalAddress;
    }

    mapping(address => uint256) internal _balances;
    mapping(address => mapping(address => uint256)) internal _allowances;

    string public name;
    string public symbol;
    uint8 public decimals;

    address public originalAddress;
    uint64 public originalChainId;

    address public immutable deployer;

    uint256 public totalSupply;

    constructor(CrossChainERC20Config memory _config) {
        name = _config.name;
        symbol = _config.symbol;
        decimals = _config.decimals;
        originalChainId = _config.originalChainId;
        originalAddress = _config.originalAddress;

        deployer = msg.sender;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
        }

        _balances[to] += amount;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address owner = msg.sender;
        _transfer(owner, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == deployer);

        _balances[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) public {
        require(msg.sender == deployer);

        _balances[from] -= amount;
        totalSupply -= amount;
    }
}