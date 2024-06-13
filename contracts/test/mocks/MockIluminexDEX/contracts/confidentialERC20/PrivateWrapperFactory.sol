// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../illuminex/op/celer/safeguard/Ownable.sol";
import "./PrivateWrapper.sol";
import "../interfaces/ILuminexUnwrapQueueConsumer.sol";
import "./BalanceRegistry.sol";
import "../interfaces/IWROSE.sol";
import "../libraries/FeesCollector.sol";

contract PrivateWrapperFactory is
    FeesCollector,
    ReentrancyGuard,
    Pausable,
    AccessControl
{
    using SafeERC20 for ERC20;

    bytes32 public constant EXECUTOR_NODE = keccak256("EXECUTOR_NODE");

    struct BufferedUnwrapRequest {
        address token;
        uint256 amount;
        address to;
        bytes callbackData;
        uint256 depositIndex;
        bool isDecoy;
    }

    struct Queue {
        bool isEnabled;
        uint256[] allowedFractions;
        address token;
        uint256 minAmount;
        uint256 queueCounter;
        mapping(uint256 => BufferedUnwrapRequest[]) queue;
        mapping(uint256 => mapping(uint256 => bool)) executed;
    }

    struct MultipleQueuesItem {
        uint256 queueIndex;
        uint256 depositIndex;
        uint256 from;
        uint256 to;
    }

    struct OutputAddress {
        bool exists;
        uint256 queueIndex;
        uint256 depositIndex;
        uint256 index;
    }

    uint256 public lastQueueIndex;
    mapping(uint256 => Queue) private _queues;

    mapping(address => uint256) private _queueIndexByToken;
    mapping(address => bool) private _queueForTokenExists;

    mapping(address => bool) private _callbackDataAllowed;
    mapping(bytes32 => OutputAddress) private _outputsAddressMap;

    uint256 public maxOutputsPerBufferedUnwrap = 5;
    uint256 public queueUnwrapPrice = 0 ether;

    mapping(address => PrivateWrapper) private _wrappers;
    mapping(address => address) private _tokenByWrapper;

    event Wrap(address indexed token, address indexed wrapper, uint256 amount);
    event Unwrap(
        address indexed token,
        address indexed wrapper,
        uint256 amount
    );

    event MaxOutputsPerUnwrapChange(uint256 newSize);
    event QueueCreated(uint256 queueIndex);
    event QueueDisabled(uint256 queueIndex);
    event QueueEnabled(uint256 queueIndex);
    event QueueMinAmountSet(uint256 indexed queueIndex, uint256 newMinAmount);

    event QueueUnwrapPriceChange(uint256 newPrice);

    event QueueUnwrapError(
        uint256 indexed queueIndex,
        uint256 depositIndex,
        uint256 index,
        bytes error
    );

    event TriggerUnwrap(
        uint256 indexed queueIndex,
        uint256 depositIndex,
        uint256 batchSize
    );

    address public immutable multicall;
    ConfidentialBalanceRegistry public balanceRegistry;

    address public immutable nativeWrapper;

    PrivateWrapperFactory public migratedFromWrapper;

    constructor(
        address _multicall,
        address _nativeWrapper,
        address _balanceRegistry,
        address payable _migrateFrom
    ) {
        multicall = _multicall;

        if (_balanceRegistry == address(0)) {
            balanceRegistry = new ConfidentialBalanceRegistry(
                address(this),
                msg.sender,
                _multicall
            );
        } else {
            balanceRegistry = ConfidentialBalanceRegistry(_balanceRegistry);
        }

        if (_migrateFrom != address(0)) {
            migratedFromWrapper = PrivateWrapperFactory(_migrateFrom);
        }

        nativeWrapper = _nativeWrapper;

        _queues[lastQueueIndex++].isEnabled = true; // enable default fractionless queue
    }

    receive() external payable {}

    function wrappers(address _token) public view returns (PrivateWrapper) {
        if (address(migratedFromWrapper) != address(0)) {
            PrivateWrapper _migratedWrapper = migratedFromWrapper.wrappers(
                _token
            );
            if (address(_migratedWrapper) != address(0)) {
                return _migratedWrapper;
            }
        }

        return _wrappers[_token];
    }

    function tokenByWrapper(address _wrapper) public view returns (address) {
        if (address(migratedFromWrapper) != address(0)) {
            address _migratedToken = migratedFromWrapper.tokenByWrapper(
                _wrapper
            );
            if (address(_migratedToken) != address(0)) {
                return _migratedToken;
            }
        }

        return _tokenByWrapper[_wrapper];
    }

    function getQueueCounter(address token) public view returns (uint256) {
        require(_queueForTokenExists[token], "Queue does not exist");
        return _queues[_queueIndexByToken[token]].queueCounter;
    }

    function setQueueUnwrapPrice(uint256 newPrice) public onlyOwner {
        queueUnwrapPrice = newPrice;
        emit QueueUnwrapPriceChange(newPrice);
    }

    function addExecutor(address executor) public onlyOwner {
        _grantRole(EXECUTOR_NODE, executor);
    }

    function removeExecutor(address executor) public onlyOwner {
        _revokeRole(EXECUTOR_NODE, executor);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function setCallbackDataAllowed(
        address _sender,
        bool allowed
    ) public onlyOwner {
        _callbackDataAllowed[_sender] = allowed;
    }

    function setQueueMinAmount(uint256 queue, uint256 min) public onlyOwner {
        require(_queues[queue].isEnabled, "Queue is disabled");

        emit QueueMinAmountSet(queue, min);
        _queues[queue].minAmount = min;
    }

    function setMaxOutputsPerUnwrap(uint256 _size) public onlyOwner {
        emit MaxOutputsPerUnwrapChange(_size);
        maxOutputsPerBufferedUnwrap = _size;
    }

    function setFractions(
        uint256 index,
        uint256[] memory fractions
    ) public onlyOwner {
        Queue storage queue = _queues[index];
        require(queue.isEnabled, "Queue is disabled");
        require(index > 0, "Can't change the default queue");

        queue.allowedFractions = fractions;
    }

    function createQueue(
        uint256[] memory allowedFractions,
        address token
    ) public onlyOwner returns (uint256) {
        return _createQueue(allowedFractions, token);
    }

    function _createQueue(
        uint256[] memory allowedFractions,
        address token
    ) private returns (uint256) {
        uint256 newQueueIndex = lastQueueIndex++;
        Queue storage queue = _queues[newQueueIndex];
        queue.isEnabled = true;
        queue.token = token;
        queue.allowedFractions = allowedFractions;
        emit QueueCreated(newQueueIndex);

        return newQueueIndex;
    }

    function disableQueue(uint256 index) public onlyOwner {
        Queue storage queue = _queues[index];
        require(queue.isEnabled, "Queue already disabled");
        require(index > 0, "Can't disable default queue");

        queue.isEnabled = false;
        emit QueueDisabled(index);
    }

    function enableQueue(uint256 index) public onlyOwner {
        Queue storage queue = _queues[index];
        require(!queue.isEnabled, "Queue already enabled");

        queue.isEnabled = true;
        emit QueueEnabled(index);
    }

    function _emitTriggerEvents(
        uint256 queueIndex,
        Queue storage _queue
    ) private {
        uint256 depositIndex = _queue.queueCounter++;
        if (_queue.queue[depositIndex].length > 0) {
            emit TriggerUnwrap(
                queueIndex,
                depositIndex,
                _queue.queue[depositIndex].length
            );
        }
    }

    function executed(
        uint256 queueIndex,
        uint256 depositIndex,
        uint256 index
    ) public view returns (bool) {
        return _queues[queueIndex].executed[depositIndex][index];
    }

    function keyHashExists(bytes32 keyHash) public view returns (bool) {
        return _outputsAddressMap[keyHash].exists;
    }

    function _withdrawOutput(
        uint256 queueIndex,
        uint256 depositIndex,
        uint256 i
    ) private {
        require(
            !_queues[queueIndex].executed[depositIndex][i],
            "Request already executed"
        );
        _processQueue(queueIndex, depositIndex, i, i + 1);
    }

    function withdrawOutput(bytes32 keyHash) public {
        OutputAddress memory _output = _outputsAddressMap[keyHash];
        require(_output.exists, "Output does not exist");

        _withdrawOutput(
            _output.queueIndex,
            _output.depositIndex,
            _output.index
        );
    }

    function _processQueue(
        uint256 queueIndex,
        uint256 depositIndex,
        uint256 from,
        uint256 to
    ) private {
        Queue storage _queue = _queues[queueIndex];
        BufferedUnwrapRequest[] storage _requests = _queue.queue[depositIndex];

        if (to > _requests.length) {
            to = _requests.length;
        }

        for (uint i = from; i < to; i++) {
            if (_queue.executed[depositIndex][i]) {
                continue;
            }

            if (_requests[i].isDecoy) {
                ERC20(_requests[i].token).safeTransfer(
                    _requests[i].to,
                    _requests[i].amount
                );
            } else {
                PrivateWrapper(_requests[i].token).unwrap(
                    _requests[i].amount,
                    _requests[i].to
                );
            }

            if (_requests[i].callbackData.length > 0) {
                try
                    ILuminexUnwrapQueueConsumer(_requests[i].to).consume(
                        _requests[i].callbackData
                    )
                {
                    emit Unwrap(
                        tokenByWrapper(_requests[i].token),
                        _requests[i].token,
                        _requests[i].amount
                    );
                    _queue.executed[depositIndex][i] = true;
                } catch (bytes memory reason) {
                    emit QueueUnwrapError(queueIndex, depositIndex, i, reason);
                }
            } else {
                _queue.executed[depositIndex][i] = true;
            }
        }
    }

    function createWrapper(address token) public returns (address) {
        PrivateWrapper wrapper = wrappers(token);
        if (address(wrapper) == address(0)) {
            wrapper = new PrivateWrapper(
                ERC20(token),
                multicall,
                balanceRegistry
            );
            _wrappers[token] = wrapper;
            _wrappers[address(wrapper)] = wrapper;
            _tokenByWrapper[address(wrapper)] = token;

            balanceRegistry.commitToken(address(wrapper));
        }

        return address(wrapper);
    }

    function processMultipleQueues(
        MultipleQueuesItem[] calldata items
    ) public onlyRole(EXECUTOR_NODE) {
        for (uint i = 0; i < items.length; i++) {
            Queue storage _queue = _queues[items[i].queueIndex];
            require(
                items[i].depositIndex < _queue.queueCounter,
                "Invalid deposit index"
            );

            _processQueue(
                items[i].queueIndex,
                items[i].depositIndex,
                items[i].from,
                items[i].to
            );
        }
    }

    function processQueue(
        uint256 queueIndex,
        uint256 depositIndex,
        uint256 from,
        uint256 to
    ) public onlyRole(EXECUTOR_NODE) {
        Queue storage _queue = _queues[queueIndex];
        require(depositIndex < _queue.queueCounter, "Invalid deposit index");

        _processQueue(queueIndex, depositIndex, from, to);
    }

    function _allowedByQueuePolicy(
        Queue storage _queue,
        uint256 amount,
        address token
    ) private view returns (bool) {
        if (_queue.allowedFractions.length == 0) {
            return true;
        }

        if (_queue.token != address(0) && _queue.token != token) {
            return false;
        }

        if (amount < _queue.minAmount) {
            return false;
        }

        for (uint i = 0; i < _queue.allowedFractions.length; i++) {
            if (_queue.allowedFractions[i] == amount) {
                return true;
            }
        }

        return false;
    }

    function _getQueueIndexForToken(address _token) private returns (uint256) {
        if (!_queueForTokenExists[_token]) {
            _queueForTokenExists[_token] = true;
            _queueIndexByToken[_token] = _createQueue(new uint256[](0), _token);
        }

        return _queueIndexByToken[_token];
    }

    function unwrapInQueueBatchForToken(
        BufferedUnwrapRequest[] memory batch,
        bytes32 _nonce
    ) public payable {
        address _token = batch[0].token;
        for (uint i = 0; i < batch.length; i++) {
            require(batch[i].token == _token, "Non-consistent batch provided");
        }

        unwrapInQueueBatch(batch, _getQueueIndexForToken(_token), _nonce);
    }

    function unwrapInQueueBatch(
        BufferedUnwrapRequest[] memory batch,
        uint256 _queueIndex,
        bytes32 _nonce
    ) public payable whenNotPaused {
        require(
            batch.length <= maxOutputsPerBufferedUnwrap,
            "Batch is too big"
        );
        require(
            msg.value == queueUnwrapPrice * batch.length,
            "Underpaid or overpaid dequeue price"
        );

        _depositFees(queueUnwrapPrice * batch.length);

        Queue storage _queue = _queues[_queueIndex];
        require(_queue.isEnabled, "Can't push to disabled queue");

        for (uint i = 0; i < batch.length; i++) {
            if (batch[i].amount == 0) {
                continue;
            }

            if (
                batch[i].callbackData.length > 0 &&
                !_callbackDataAllowed[msg.sender]
            ) {
                continue;
            }

            _outputsAddressMap[
                keccak256(abi.encodePacked(_nonce, batch[i].depositIndex, i))
            ] = OutputAddress(
                true,
                _queueIndex,
                batch[i].depositIndex + _queue.queueCounter,
                _queue.queue[batch[i].depositIndex + _queue.queueCounter].length
            );

            batch[i].depositIndex += _queue.queueCounter;

            address token = tokenByWrapper(batch[i].token);
            require(token != address(0), "Invalid wrapper");
            require(
                _allowedByQueuePolicy(_queue, batch[i].amount, batch[i].token),
                "Invalid fraction amount provided"
            );

            ERC20(batch[i].token).safeTransferFrom(
                msg.sender,
                address(this),
                batch[i].amount
            );
            _queue.queue[batch[i].depositIndex].push(batch[i]);
        }

        _emitTriggerEvents(_queueIndex, _queue);
    }

    function _wrap(address token, uint256 amount, address to) private {
        PrivateWrapper wrapper = PrivateWrapper(createWrapper(token));

        ERC20(token).approve(address(wrapper), amount);
        wrapper.wrap(amount, to);
        emit Wrap(token, address(wrapper), amount);
    }

    function wrap(
        address token,
        uint256 amount,
        address to
    ) public payable whenNotPaused {
        if (tokenByWrapper(token) != address(0)) {
            return;
        }

        if (token == nativeWrapper) {
            require(msg.value == amount, "Invalid value for wrapping");
            IWROSE(token).deposit{value: amount}();
        } else {
            ERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        _wrap(token, amount, to);
    }

    function wrapERC20(
        address token,
        uint256 amount,
        address to
    ) public whenNotPaused {
        if (tokenByWrapper(token) != address(0)) {
            return;
        }

        ERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _wrap(token, amount, to);
    }

    function _unwrap(address wrapper, uint256 amount) private {
        address token = tokenByWrapper(wrapper);
        require(token != address(0), "Invalid wrapper");

        ERC20(wrapper).safeTransferFrom(msg.sender, address(this), amount);

        PrivateWrapper(wrapper).unwrap(amount, address(this));
        emit Unwrap(token, wrapper, amount);
    }

    function unwrap(
        address wrapper,
        uint256 amount,
        address to
    ) public whenNotPaused {
        _unwrap(wrapper, amount);

        if (tokenByWrapper(wrapper) == nativeWrapper) {
            IWROSE(nativeWrapper).withdraw(amount);
            payable(to).transfer(amount);
        } else {
            ERC20(tokenByWrapper(wrapper)).safeTransfer(to, amount);
        }
    }

    function unwrapERC20(
        address wrapper,
        uint256 amount,
        address to
    ) public whenNotPaused {
        _unwrap(wrapper, amount);
        ERC20(tokenByWrapper(wrapper)).safeTransfer(to, amount);
    }
}
