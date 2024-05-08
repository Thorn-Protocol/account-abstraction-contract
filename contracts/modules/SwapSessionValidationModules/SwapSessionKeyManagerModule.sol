// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {BaseAuthorizationModule} from "../BaseAuthorizationModule.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import {ISessionKeyManager} from "../../interfaces/ISessionKeyManager.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./BuyValidator.sol";
import "./SellValidator.sol";
import "./PreApproveValidator.sol";

interface ISmartAccount {
    function getOwner(address smartAccount) external view returns (address);
}

contract SwapSessionKeyManager is BaseAuthorizationModule {
    address public ECDSA_MODULE_ADDRESS;
    address public WRAPPED_NATIVE_TOKEN;
    address public FEE_RECIPIENT;
    uint48 public constant FEE_RATE_PRECISION = 1e6;
    uint48 public constant HALF_FEE_RATE_PRECISION = 5e5;
    uint48 public FEE_RATE;
    uint256 public FEE_THRESHOLD;

    constructor(
        address _ECDSA_MODULE_ADDRESS,
        address _WRAPPED_NATIVE_TOKEN,
        address _FEE_RECIPIENT,
        uint48 _FEE_RATE,
        uint256 _FEE_THRESHOLD
    ) {
        ECDSA_MODULE_ADDRESS = _ECDSA_MODULE_ADDRESS;
        WRAPPED_NATIVE_TOKEN = _WRAPPED_NATIVE_TOKEN;
        FEE_RECIPIENT = _FEE_RECIPIENT;
        require(
            _FEE_RATE < FEE_RATE_PRECISION,
            "Fee rate must be less than 100%"
        );
        FEE_RATE = _FEE_RATE;
        FEE_THRESHOLD = _FEE_THRESHOLD;
    }

    /**
     * @dev mapping of owner to a session root
     */
    mapping(address => bytes32) public merkleRoot;

    /**
     * @dev mapping of owner to trading quota
     */
    mapping(address => uint256) public tradingQuota;

    /**
     * @dev mapping of session key to accumulated fee
     */
    mapping(address => uint256) public accumulatedFee;

    function setMerkleRootAndTradingQuota(bytes32 _merkleRoot, uint256 _tradingQuota) external {
        merkleRoot[msg.sender] = _merkleRoot;
        tradingQuota[msg.sender] = _tradingQuota;
    }

    /**
     * @dev validates userOperation
     * @param userOp User Operation to be validated.
     * @param userOpHash Hash of the User Operation to be validated.
     * @return sigValidationResult 0 if signature is valid, SIG_VALIDATION_FAILED otherwise.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external virtual returns (uint256) {
        address sender = userOp.sender;
        address owner = ISmartAccount(ECDSA_MODULE_ADDRESS).getOwner(sender);

        (bytes memory moduleSignature, ) = abi.decode(
            userOp.signature,
            (bytes, address)
        );
        (
            uint48 validUntil,
            uint48 validAfter,
            address router,
            address token,
            address sessionKey,
            uint256 maxETHSpend,
            uint256 spentAmount,
            bool approveAll,
            bool isBuyOrder,
            bytes32[] memory merkleProof,
            bytes memory sessionKeySignature
        ) = abi.decode(
                moduleSignature,
                (
                    uint48,
                    uint48,
                    address,
                    address,
                    address,
                    uint256,
                    uint256,
                    bool,
                    bool,
                    bytes32[],
                    bytes
                )
            );

        bytes32 root = merkleRoot[owner];

        bytes32 leaf;
        if (!approveAll)
            leaf = keccak256(
                abi.encodePacked(
                    validUntil,
                    validAfter,
                    token,
                    sessionKey,
                    sender,
                    router,
                    maxETHSpend
                )
            );
        else
            leaf = keccak256(
                abi.encodePacked(
                    validUntil,
                    validAfter,
                    sessionKey,
                    sender,
                    router,
                    maxETHSpend
                )
            );
        if (!MerkleProof.verify(merkleProof, root, leaf)) {
            revert("SessionNotApproved");
        }

        bool validSig = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(userOpHash),
            sessionKeySignature
        ) == sessionKey;

        bool validOp;

        if (spentAmount > 0) {
            require(
                token != address(0) && token != WRAPPED_NATIVE_TOKEN,
                "Specified token must be non-native"
            );

            if (spentAmount > maxETHSpend)
                revert("Maximum ETH per tx exceeded");
            uint256 currentTradingQuota = tradingQuota[owner];
            if (spentAmount > currentTradingQuota)
                revert("Trading quota exceeded");
            tradingQuota[owner] = currentTradingQuota - spentAmount;

            uint256 fee = (spentAmount * FEE_RATE + HALF_FEE_RATE_PRECISION) /
                FEE_RATE_PRECISION;

            uint256 currentAccumulatedFee = accumulatedFee[sessionKey] + fee;
            uint256 payment;
            if (currentAccumulatedFee >= FEE_THRESHOLD) {
                payment = currentAccumulatedFee;
                accumulatedFee[sessionKey] = 0;
            } else {
                payment = 0;
                accumulatedFee[sessionKey] = currentAccumulatedFee;
            }

            if (isBuyOrder) {
                validOp = BuyValidator.validateBuy(
                    userOp,
                    token,
                    spentAmount,
                    payment,
                    WRAPPED_NATIVE_TOKEN,
                    router,
                    FEE_RECIPIENT
                );
            } else {
                validOp = SellValidator.validateSell(
                    userOp,
                    token,
                    spentAmount,
                    payment,
                    WRAPPED_NATIVE_TOKEN,
                    router,
                    FEE_RECIPIENT
                );
            }
        } else {
            // approve
            validOp = PreApproveValidator.validatePreApprove(
                userOp,
                token,
                router
            );
        }

        return
            _packValidationData(
                //_packValidationData expects true if sig validation has failed, false otherwise
                !(validOp && validSig),
                validUntil,
                validAfter
            );
    }

    /**
     * @dev returns the SessionStorage object for a given owner
     * @param owner owner address
     */
    function getSessionRoot(address owner) external view returns (bytes32) {
        return merkleRoot[owner];
    }

    /**
     * @dev returns the accumulated fee of a given sessionKey
     * @param sessionKey sessionKey address
     */
    function getAccumulatedFee(
        address sessionKey
    ) external view returns (uint256) {
        return accumulatedFee[sessionKey];
    }

    /**
     * @dev isValidSignature according to BaseAuthorizationModule
     * @param _dataHash Hash of the data to be validated.
     * @param _signature Signature over the the _dataHash.
     * @return always returns 0xffffffff as signing messages is not supported by SessionKeys
     */
    function isValidSignature(
        bytes32 _dataHash,
        bytes memory _signature
    ) public pure override returns (bytes4) {
        (_dataHash, _signature);
        return 0xffffffff; // do not support it here
    }
}
