// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CrossChainERC20.sol";
import "./ICrossChainVault.sol";
import "../op/IMultichainEndpoint.sol";
import "../op/celer/message/framework/MessageApp.sol";

contract CrossChainVaultApp is MessageApp, Ownable {
    using SafeERC20 for ERC20;

    enum CrossChainVaultMessageType {
        LockAndMint,
        BurnAndUnlock
    }

    struct SetAllowedSender {
        address sender;
        uint64 srcChainId;
        bool isAllowed;
    }

    struct CrossChainAssetData {
        bool isDataSet;
        address token;
        string name;
        string symbol;
        uint8 decimals;
        uint64 chainId;
    }

    event SetAuthorisedSender(address indexed sender, uint64 indexed chainId, bool isSet);
    event ActualEndpointChange(address prev, address updated);
    event EndpointExecutionReverted(bytes reason);

    ICrossChainVault public immutable vault;
    IMultichainEndpoint public endpoint;

    mapping(uint64 => mapping(address => CrossChainERC20)) public mintedTokenByOriginal;
    mapping(uint64 => mapping(CrossChainERC20 => address)) public originalTokenByMinted;

    mapping(address => mapping(uint64 => bool)) public allowedSenders;
    mapping(uint64 => bool) public allowedSenderSetup;
    mapping(address => mapping(uint64 => CrossChainAssetData)) public crossChainAssetsData;

    constructor(address _vault, address _messageBus) MessageApp(_messageBus) {
        vault = ICrossChainVault(_vault);
    }

    function setActualEndpoint(address _endpoint) public onlyOwner {
        require(address(endpoint) == address(0), "The endpoint is already configured");

        emit ActualEndpointChange(address(endpoint), _endpoint);
        endpoint = IMultichainEndpoint(_endpoint);
    }

    function setCrossChainAssets(CrossChainAssetData[] calldata assets) public onlyOwner {
        for (uint i = 0; i < assets.length; i++) {
            crossChainAssetsData[assets[i].token][assets[i].chainId] = assets[i];
        }
    }

    function setAllowedSenders(SetAllowedSender[] calldata senders) public onlyOwner {
        for (uint i = 0; i < senders.length; i++) {
            // We can't add new senders for same chain id otherwise it would be dangerous
            require(!allowedSenderSetup[senders[i].srcChainId], "Sender is already setup");

            emit SetAuthorisedSender(senders[i].sender, senders[i].srcChainId, senders[i].isAllowed);
            allowedSenders[senders[i].sender][senders[i].srcChainId] = senders[i].isAllowed;
            allowedSenderSetup[senders[i].srcChainId] = true;
        }
    }

    function executeMessage(
        address srcContract,
        uint64 _srcChainId,
        bytes calldata _message,
        address
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        require(allowedSenders[srcContract][_srcChainId], "Unauthorised sender");

        (bytes memory lockData, bytes memory _data) = abi.decode(_message, (bytes, bytes));
        (address token, uint256 amount) = _processVaultCommand(_srcChainId, lockData);

        ERC20(token).safeTransfer(address(endpoint), amount);
        IMultichainEndpoint.CallbackExecutionStatus status = IMultichainEndpoint.CallbackExecutionStatus.Failed;

        try endpoint.executeMessageWithTransfer(
            token,
            amount,
            _srcChainId,
            _data
        ) returns (IMultichainEndpoint.CallbackExecutionStatus _status) {
            status = _status;
        } catch (bytes memory reason) {
            emit EndpointExecutionReverted(reason);
            status = endpoint.executeMessageWithTransferFallback(
                token,
                amount,
                _data
            );
        }

        if (status == IMultichainEndpoint.CallbackExecutionStatus.Success) {
            return ExecutionStatus.Success;
        } else if (status == IMultichainEndpoint.CallbackExecutionStatus.Failed) {
            return ExecutionStatus.Fail;
        } else if (status == IMultichainEndpoint.CallbackExecutionStatus.Retry) {
            return ExecutionStatus.Retry;
        }

        return ExecutionStatus.Fail;
    }

    function _processVaultCommand(uint64 srcChainId, bytes memory rawCommand) private returns (address token, uint256 amt) {
        (uint8 _type, address srcAddress, uint256 amount) = abi.decode(rawCommand, (uint8, address, uint256));
        CrossChainVaultMessageType cmdType = CrossChainVaultMessageType(_type);

        amt = amount;

        if (cmdType == CrossChainVaultMessageType.LockAndMint) {
            CrossChainAssetData memory data = crossChainAssetsData[srcAddress][srcChainId];
            require(data.isDataSet, "Metadata is not set");

            token = _mintTokens(CrossChainERC20.CrossChainERC20Config(
                data.name,
                data.symbol,
                data.decimals,
                srcChainId,
                srcAddress
            ), amount);
        } else if (cmdType == CrossChainVaultMessageType.BurnAndUnlock) {
            vault.unlock(srcAddress, amount);
            token = srcAddress;
        } else {
            revert();
        }
    }

    function _mintTokens(CrossChainERC20.CrossChainERC20Config memory originalTokenDetails, uint256 amount) private returns (address) {
        CrossChainERC20 minted = mintedTokenByOriginal[originalTokenDetails.originalChainId][originalTokenDetails.originalAddress];
        if (address(minted) == address(0)) {
            minted = new CrossChainERC20(originalTokenDetails);

            mintedTokenByOriginal[originalTokenDetails.originalChainId][originalTokenDetails.originalAddress] = minted;
            originalTokenByMinted[originalTokenDetails.originalChainId][minted] = originalTokenDetails.originalAddress;
        }

        minted.mint(address(this), amount);

        return address(minted);
    }

    receive() external payable {}

    function lockAndMint(address to, uint64 chainId, address token, uint256 amount, bytes memory message) public payable {
        require(msg.sender == address(endpoint), "Invalid endpoint");

        ERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        ERC20(token).safeIncreaseAllowance(address(vault), amount);
        amount = vault.lock(token, amount);

        bytes memory lockData = abi.encode(uint8(CrossChainVaultMessageType.LockAndMint), token, amount);
        bytes memory payload = abi.encode(lockData, message);

        sendMessage(to, chainId, payload, IMessageBus(messageBus).calcFee(payload));
    }

    function burnAndUnlock(address to, uint64 chainId, address token, uint256 amount, bytes memory message) public payable {
        require(msg.sender == address(endpoint), "Invalid endpoint");
        require(originalTokenByMinted[chainId][CrossChainERC20(token)] != address(0), "Invalid cross-chain token");

        ERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        CrossChainERC20 crossChainToken = CrossChainERC20(token);
        crossChainToken.burn(address(this), amount);

        bytes memory unlockData = abi.encode(uint8(CrossChainVaultMessageType.BurnAndUnlock), crossChainToken.originalAddress(), amount);
        bytes memory payload = abi.encode(unlockData, message);

        sendMessage(to, chainId, payload, IMessageBus(messageBus).calcFee(payload));
    }
}
