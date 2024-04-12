// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../illuminex/op/celer/safeguard/Ownable.sol";
import "./PrivateWrapper.sol";
import "./ERC2771Context.sol";

contract ConfidentialBalanceRegistry is ERC2771Context, AccessControl, Ownable {
    bytes32 public constant NEW_TOKEN_COMMITER = keccak256("NEW_TOKEN_COMMITER");
    bytes32 public constant COMMITED_TOKEN = keccak256("COMMITED_TOKEN");

    struct TokenData {
        uint256 balance;
        address token;
        string name;
        string symbol;
        uint decimals;
    }

    mapping(address => address[]) private _registry;
    mapping(address => mapping(address => bool)) private _isTokenHeld;
    mapping(address => mapping(address => uint256)) private _keyIndexedPositions;

    event DustThresholdChanged(address indexed token, uint256 newValue);

    mapping(address => uint256) public dustThreshold;

// TODO commiter is for granting role to mint, burn token
// what should commiter be?
    constructor(address _commiter, address _owner, address _multicall) ERC2771Context(_multicall) {
        _grantRole(NEW_TOKEN_COMMITER, _commiter);
        transferOwnership(_owner);
    }

    function _msgSender() internal view override(Context, ERC2771Context) virtual returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) virtual returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function addCommitter(address _committer) public onlyOwner {
        _grantRole(NEW_TOKEN_COMMITER, _committer);
    }

    function setDustThreshold(address token, uint256 newThreshold) public onlyOwner {
        dustThreshold[token] = newThreshold;
        emit DustThresholdChanged(token, newThreshold);
    }

    function commitToken(address _token) public onlyRole(NEW_TOKEN_COMMITER) {
        _grantRole(COMMITED_TOKEN, _token);
    }

    function onTransfer(address to, address from, uint256 newBalanceFrom) public onlyRole(COMMITED_TOKEN) {
        address _wrappedTokenAddress = msg.sender;

        if (!_isTokenHeld[to][_wrappedTokenAddress] && to != address(0)) {
            _keyIndexedPositions[to][_wrappedTokenAddress] = _registry[to].length;
            _registry[to].push(_wrappedTokenAddress);
            _isTokenHeld[to][_wrappedTokenAddress] = true;
        }

        if (newBalanceFrom <= dustThreshold[_wrappedTokenAddress] && from != address(0)) {
            _isTokenHeld[from][_wrappedTokenAddress] = false;

            require(_keyIndexedPositions[from][_wrappedTokenAddress] < _registry[from].length, "Invalid transfer");
            _keyIndexedPositions[from][_registry[from][_registry[from].length - 1]] = _keyIndexedPositions[from][_wrappedTokenAddress];
            _registry[from][_keyIndexedPositions[from][_wrappedTokenAddress]] = _registry[from][_registry[from].length - 1];
            _registry[from].pop();
        }
    }

    function getHeldTokensCount() public view returns (uint256) {
        return _registry[_msgSender()].length;
    }

    function getHeldTokens(uint offset, uint limit) public view returns (TokenData[] memory, uint256) {
        if (limit > _registry[_msgSender()].length) {
            limit = _registry[_msgSender()].length;
        }

        TokenData[] memory _result = new TokenData[](limit - offset);
        for (uint i = offset; i < limit; i++) {
            ERC20 token = ERC20(_registry[_msgSender()][i]);
            _result[i - offset] = TokenData(
                token.balanceOf(_msgSender()),
                address(token),
                token.name(),
                token.symbol(),
                token.decimals()
            );
        }

        return (_result, _registry[_msgSender()].length);
    }
}