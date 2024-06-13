// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./MultichainEndpoint.sol";
import "./celer/message/interfaces/IMessageBus.sol";
import "../../interfaces/ILuminexUnwrapQueueConsumer.sol";
import "../../confidentialERC20/PrivateWrapperFactory.sol";
import '../../interfaces/IWROSE.sol';
import "../../libraries/LuminexLibrary.sol";

contract SapphireEndpoint is MultichainEndpoint, ILuminexUnwrapQueueConsumer, Pausable {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    bytes32[] private _ringKeys;
    uint256 private _lastRingKeyUpdate;
    bytes32 private _revealEncryptionKey;

    uint256 public ringKeyUpdateInterval = 1 days;
    uint256 public gasFailureDustRefund;

    event GasRefundSwapFailed(bytes reason);
    event EncryptedReport(uint256 indexed keyIndex, bytes data);

    mapping(bytes32 => uint256) public batchCounterSnapshotByHash;
    mapping(uint256 => bytes32) private _revealedKeys;

    enum ProxyPassOutputType {
        QueuedUnwrapped,
        QueuedWrapped,
        Instant
    }

    struct ProxyPassOutput {
        address to;
        uint256 amount;
        uint64 chainId;
        uint256 depOffset;
        ProxyPassOutputType kind;
    }

    struct ProxyPassRequestParams {
        bytes32 nonce;
        address[] swapPath;
        ProxyPassOutput[] outputs;
    }

    bytes public constant ENC_CONST = "ILLUMINEX_V1";
    uint public constant REVEAL_KEYS_OFFSET = 1;

    PrivateWrapperFactory public immutable wrapperFactory;
    ILuminexRouterV1 public immutable swapRouter;

    event ActualRingKeyRenewed(uint indexed newKeyIndex);
    event QueueUnwrapped(bytes32 indexed hashedEventKey);
    event RingKeyUpdateIntervalChange(uint256 newInterval);
    event SetGasFailureDustRefund(uint256 newValue);
    event RevealKeyRange(uint256 from, uint256 to);
    event RevealEncryptionKeyChange();

    constructor(
        address payable _wrapperFactory,
        address payable _vault,
        address payable _illiminexRouter,
        bytes32 _genesis
    ) MultichainEndpoint(_vault) {
        wrapperFactory = PrivateWrapperFactory(_wrapperFactory);
        swapRouter = ILuminexRouterV1(_illiminexRouter);

        _updateRingKey(_genesis);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setGasFailureDustRefund(uint256 _newValue) public onlyOwner {
        emit SetGasFailureDustRefund(_newValue);
        gasFailureDustRefund = _newValue;
    }

    function setRingKeyUpdateInterval(uint256 _newInterval) public onlyOwner {
        ringKeyUpdateInterval = _newInterval;
        emit RingKeyUpdateIntervalChange(_newInterval);
    }

    function _updateRingKey(bytes32 _entropy) private {
        bytes32 newKey = bytes32(Sapphire.randomBytes(32, abi.encodePacked(_entropy)));

        uint newIndex = _ringKeys.length;
        _ringKeys.push(newKey);

        _lastRingKeyUpdate = block.timestamp;

        emit ActualRingKeyRenewed(newIndex);
    }

    function _renewActualRingKey(bytes32 _entropy) private {
        if (_lastRingKeyUpdate + ringKeyUpdateInterval > block.timestamp) {
            return;
        }

        _updateRingKey(_entropy);
    }

    function _computeNonce(uint256 keyIndex) private pure returns (bytes32 nonce) {
        nonce = keccak256(abi.encodePacked(keyIndex, ENC_CONST));
    }

    function _decrypt(bytes memory _keyData) private view returns (uint256 ringKeyIndex, bytes memory output) {
        (uint256 _ringKeyIndex, bytes memory _encryptedData) = abi.decode(_keyData, (uint256, bytes));
        require(_ringKeyIndex < _ringKeys.length, "No ring key found");

        bytes32 nonce = _computeNonce(_ringKeyIndex);

        output = Sapphire.decrypt(_ringKeys[_ringKeyIndex], nonce, _encryptedData, ENC_CONST);
        ringKeyIndex = _ringKeyIndex;
    }

    function _preprocessPayloadData(bytes memory data) internal virtual override view returns(address sender, uint256 fee, bytes memory output) {
        (address _sender, uint256 _fee, bytes memory _keyData) = abi.decode(data, (address, uint256, bytes));
        (, bytes memory _output) = _decrypt(_keyData);

        output = _output;
        fee = _fee;
        sender = _sender;
    }

    function encryptPayload(bytes memory payload) private view returns (bytes memory encryptedData, uint256 keyIndex) {
        require(_ringKeys.length > 0, "No ring keys set up");

        keyIndex = _ringKeys.length - 1;
        bytes32 nonce = _computeNonce(keyIndex);
        encryptedData = Sapphire.encrypt(_ringKeys[keyIndex], bytes32(nonce), payload, abi.encodePacked(ENC_CONST));
    }

    function proxyPass(address token, uint256 amount, bytes memory encodedParams) public override payable {
        uint256 feesValue = msg.value;
        if (token == swapRouter.WROSE()) {
            require(msg.value >= amount, "Insufficient native amount");
            IWROSE(swapRouter.WROSE()).deposit{value: amount}();
            feesValue -= amount;
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        require(block.chainid == SAPPHIRE_CHAINID, "Can pass only from Sapphire");

        _depositFees(feesValue);

        (, bytes memory data) = _decrypt(encodedParams);
        _dataHashToSender[keccak256(data)] = msg.sender;

        require(_handleProxyPass(data, amount, token, feesValue) != CallbackExecutionStatus.Failed, "Failed");
    }

    function executeMessageWithTransferFallback(
        address _token,
        uint256 _amount,
        bytes calldata _message
    ) external payable virtual override returns (CallbackExecutionStatus _status) {
        require(msg.sender == address(vaultApp), "Unauthorized vault app");

        require(!_executedMessages[keccak256(_message)], "Callback already executed");

        (address sender,,) = _preprocessPayloadData(_message);

        _executedMessages[keccak256(_message)] = true;
        _failedMessages[keccak256(_message)] = true;

        PrivateWrapper _wrappedPrivateROSE = wrapperFactory.wrappers(swapRouter.WROSE());

        uint _amountMaxIn = _amount / 100;

        IERC20(_token).safeIncreaseAllowance(address(wrapperFactory), _amountMaxIn);
        wrapperFactory.wrapERC20(_token, _amountMaxIn, address(this));

        address[] memory _path = new address[](2);
        _path[0] = address(wrapperFactory.wrappers(_token));
        _path[1] = address(_wrappedPrivateROSE);

        IERC20(_path[0]).safeIncreaseAllowance(address(swapRouter), _amountMaxIn);
        try swapRouter.swapTokensForExactTokens(
            gasFailureDustRefund,
            _amountMaxIn,
            _path,
            address(this),
            block.timestamp
        ) returns (uint[] memory _amounts) {
            // Unwrap native tokens
            IERC20(_path[1]).safeIncreaseAllowance(address(wrapperFactory), _amounts[1]);
            wrapperFactory.unwrap(_path[1], _amounts[1], sender);

            // Unwrap remainder
            uint256 remainder = _amountMaxIn - _amounts[0];
            if (remainder > 0) {
                IERC20(_path[0]).safeIncreaseAllowance(address(wrapperFactory), remainder);
                wrapperFactory.unwrapERC20(_path[0], remainder, sender);
            }

            _transferTokensTo(sender, _token, _amount - _amountMaxIn);
            _status = CallbackExecutionStatus.Success;
        } catch (bytes memory reason) {
            IERC20(_path[0]).safeIncreaseAllowance(address(wrapperFactory), _amountMaxIn);
            wrapperFactory.unwrapERC20(_path[0], _amountMaxIn, address(this));
            _transferTokensTo(sender, _token, _amount);

            emit GasRefundSwapFailed(reason);
            _status = CallbackExecutionStatus.Failed;
        }
    }

    function prepareEncryptedParams(ProxyPassRequestParams memory params) public view returns (bytes memory encoded, uint256 keyIndex) {
        require(params.outputs.length > 0, "Invalid outputs list");

        bytes memory header = abi.encode(uint8(MultichainCommandType.ProxyPass), params.nonce, params.swapPath);
        bytes[] memory bodyParts = new bytes[](params.outputs.length);

        for (uint i = 0; i < params.outputs.length; i++) {
            ProxyPassOutput memory output = params.outputs[i];
            bodyParts[i] = abi.encode(output.chainId, output.to, output.amount, output.depOffset, uint8(output.kind));
        }

        (encoded, keyIndex) = encryptPayload(abi.encode(header, bodyParts));
    }

    function changeRevealEncryptionKey(bytes32 _newKey) public onlyComplianceManager {
        _revealEncryptionKey = _newKey;
        emit RevealEncryptionKeyChange();
    }

    function fetchRevealedKeys(uint256 from, uint256 to) public view onlyComplianceManager returns (bytes[] memory _result) {
        bytes[] memory _encryptedRingKeys = new bytes[](to - from);
        for (uint i = 0; i < _encryptedRingKeys.length; i++) {
            _encryptedRingKeys[i] = Sapphire.encrypt(
                _revealEncryptionKey,
                keccak256(abi.encodePacked(from, to, ENC_CONST, i)),
                abi.encode(_revealedKeys[from + i]),
                ENC_CONST
            );
        }

        return _encryptedRingKeys;
    }

    function revealKeysInRange(uint256 from, uint256 to) public onlyComplianceManager {
        require(to < _ringKeys.length - REVEAL_KEYS_OFFSET, "Can't reveal early range");

        for (uint i = from; i < to; i++) {
            _revealedKeys[i] = _ringKeys[i];
        }

        emit RevealKeyRange(from, to);
    }

    function _submitEncryptedReport(address _sender, bytes[] memory _outputs) private {
        (bytes memory data, uint256 keyIndex) = encryptPayload(abi.encode(_sender, _outputs));
        emit EncryptedReport(keyIndex, data);
    }

    function _finalizeOutput(bytes32 keyIndex, address _token, uint256 amount, uint64 dstChainId, address dstAddress) private {
        if (dstChainId == SAPPHIRE_CHAINID) {
            if (_token == swapRouter.WROSE()) {
                IWROSE(swapRouter.WROSE()).withdraw(amount);
                payable(dstAddress).transfer(amount);

                return;
            }

            IERC20(_token).safeTransfer(dstAddress, amount);
            return;
        }

        if (wrapperFactory.tokenByWrapper(_token) != address(0)) {
            wrapperFactory.unwrapERC20(_token, amount, address(this));
            _token = wrapperFactory.tokenByWrapper(_token);
        }

        bytes memory encodedData = _encodeReceiveCommand(dstAddress, keyIndex);
        bytes memory bridgeTemplate = abi.encode(uint8(0), address(0), uint256(0));

        uint _feesByCeler = IMessageBus(messageBus).calcFee(abi.encode(bridgeTemplate, encodedData));

        IERC20(_token).safeIncreaseAllowance(address(vaultApp), amount);

        vaultApp.burnAndUnlock{value: _feesByCeler}(
            connectedEndpoints[dstChainId],
            dstChainId,
            _token,
            amount,
            encodedData
        );

        emit MultichainMessageSent(keyIndex);
        settledMessages[MessageStoreType.MultichainMessageSent][keyIndex] = true;
    }

    function consume(bytes memory data) public override {
        require(msg.sender == address(wrapperFactory));

        (bytes32 keyIndex, address _token, uint256 amount, uint64 dstChainId, address dstAddress) = abi.decode(
            data,
            (bytes32, address, uint256, uint64, address)
        );

        emit QueueUnwrapped(keyIndex);
        settledMessages[MessageStoreType.QueueUnwrapped][keyIndex] = true;

        _finalizeOutput(keyIndex, _token, amount, dstChainId, dstAddress);
    }

    function _extractDepIndexFromEntry(bytes memory _entry) private pure returns (uint256) {
        (,,,uint256 _depIndex,) = _decodeProxyPassCommand(_entry);
        return _depIndex;
    }

    function _handleProxyPass(bytes memory _data, uint256 _totalAmount, address _token, uint256 fee) internal virtual override returns (CallbackExecutionStatus) {
        (bytes memory header, bytes[] memory entries) = abi.decode(_data, (bytes, bytes[]));
        (, bytes32 _nonce, address[] memory _swapPath) = abi.decode(header, (uint8, bytes32, address[]));

        if (entries.length == 0) {
            return CallbackExecutionStatus.Failed;
        }

        emit MessageReceived(keccak256(abi.encodePacked(_nonce, entries.length)), false);
        settledMessages[MessageStoreType.MessageReceived][keccak256(abi.encodePacked(_nonce, entries.length))] = true;

        _renewActualRingKey(keccak256(abi.encodePacked(_data, _totalAmount, _token, fee)));
        _submitEncryptedReport(_dataHashToSender[keccak256(_data)], entries);

        // Wrap the source token to the confidential wrapper
        IERC20(_token).approve(address(wrapperFactory), _totalAmount);
        if (address(wrapperFactory.tokenByWrapper(_token)) == address(0)) {
            wrapperFactory.wrapERC20(_token, _totalAmount, address(this));
        }

        _token = address(wrapperFactory.tokenByWrapper(_token)) != address(0) ? _token : address(wrapperFactory.wrappers(_token));

        {
            uint256 _totalAmountByEntries = 0;
            uint256 totalDstGasFee = wrapperFactory.queueUnwrapPrice() * entries.length;
            for (uint i = 0; i < entries.length; i++) {
                (uint64 dstChainId, address dstAddress, uint256 amount,,) = _decodeProxyPassCommand(entries[i]);

                address dstContract = connectedEndpoints[dstChainId];
                if (dstChainId != SAPPHIRE_CHAINID) {
                    require(dstContract != address(0), "Unsupported endpoint");
                }

                _totalAmountByEntries += amount;

                if (dstChainId != SAPPHIRE_CHAINID) {
                    totalDstGasFee += endpointsDestinationFees[dstChainId].settlementCostInLocalCurrency
                        + IMessageBus(messageBus).calcFee(
                            abi.encode(
                                abi.encode(uint8(0), address(0), uint256(0)), // lock-and-mint header
                                _encodeReceiveCommand(dstAddress, keccak256(ENC_CONST))
                            )
                        );
                }
            }

            if (totalDstGasFee > 0) {
                require(totalDstGasFee <= fee, "Insufficient fee provided");
            }

            // Perform the swap
            if (_swapPath.length >= 2) {
                // First swap entry must the the same as wrapped token
                require(_swapPath[0] == _token && address(wrapperFactory.tokenByWrapper(_swapPath[_swapPath.length - 1])) != address(0), "Invalid swap path presented");

                // We will settle outputs in the resulting token which must be a wrapped token
                _token = _swapPath[_swapPath.length - 1];

                {
                    // NOTE: The _swapPath must be constructed from wrapped tokens
                    IERC20(_swapPath[0]).safeIncreaseAllowance(address(swapRouter), _totalAmount);

                    uint256 balanceBefore = IERC20(_swapPath[_swapPath.length - 1]).balanceOf(address(this));
                    swapRouter.swapExactTokensForTokens(_totalAmount, _totalAmountByEntries, _swapPath, address(this), block.timestamp);
                    uint256 balanceAfter = IERC20(_swapPath[_swapPath.length - 1]).balanceOf(address(this));

                    _totalAmount = balanceAfter - balanceBefore;
                }
            }

            // Received amount after the swap can't exceed the transferred amount
            require(_totalAmountByEntries <= _totalAmount, "Entries amount does not match the total amount");

            if (_totalAmount > _totalAmountByEntries) {
                (uint64 dstChainId, address dstAddress, uint256 amount, uint256 depIndex, uint8 kind) = _decodeProxyPassCommand(
                    entries[entries.length - 1]
                );

                amount += (_totalAmount - _totalAmountByEntries);
                entries[entries.length - 1] = abi.encode(dstChainId, dstAddress, amount, depIndex, kind);
            }
        }

        IERC20(_token).safeIncreaseAllowance(address(wrapperFactory), _totalAmount);

        {
            PrivateWrapperFactory.BufferedUnwrapRequest[] memory requests = new PrivateWrapperFactory.BufferedUnwrapRequest[](entries.length);
            for (uint i = 0; i < entries.length; i++) {
                (uint64 dstChainId, address dstAddress, uint256 amount,, uint8 kind) = _decodeProxyPassCommand(entries[i]);
                if (amount == 0) {
                    continue;
                }

                if (ProxyPassOutputType(kind) == ProxyPassOutputType.Instant) {
                    _finalizeOutput(keccak256(abi.encodePacked(_nonce, dstChainId, dstAddress, i)), _token, amount, dstChainId, dstAddress);
                    continue;
                }

                {
                    address _unwrapped = wrapperFactory.tokenByWrapper(_token);
                    require(_unwrapped != address(0), "Can't buffer unwrap a regular token");

                    if (ProxyPassOutputType(kind) == ProxyPassOutputType.QueuedWrapped) {
                        _unwrapped = _token;
                    }

                    requests[i] = PrivateWrapperFactory.BufferedUnwrapRequest(
                        _token,
                        amount,
                        address(this),
                        abi.encode(
                            keccak256(abi.encodePacked(_nonce, dstChainId, dstAddress, i)),
                            _unwrapped,
                            amount,
                            dstChainId,
                            dstAddress
                        ),
                        _extractDepIndexFromEntry(entries[i]),
                        ProxyPassOutputType(kind) == ProxyPassOutputType.QueuedWrapped
                    );
                }
            }

            wrapperFactory.unwrapInQueueBatchForToken{value: wrapperFactory.queueUnwrapPrice() * requests.length}(requests, _nonce);
            batchCounterSnapshotByHash[keccak256(abi.encodePacked(_nonce, "batchSnapshot", _nonce))] = wrapperFactory.getQueueCounter(_token);
        }

        return CallbackExecutionStatus.Success;
    }
}
