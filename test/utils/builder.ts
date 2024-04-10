import { BigNumber, Wallet } from "ethers";
import { defaultAbiCoder, parseEther } from "ethers/lib/utils";
import { SmartAccount__factory } from "../../typechain-types";
import { fillAndSign } from "./userOp";
import ContractAddress from "../config/contracts";
import { AddressZero } from "../config/constants";
import { Transaction } from "../types/transaction";

interface BuilderOptions {
    preVerificationGas?: number;
}
export default class SessionKeyUserOpBuilder {
    transactions: Transaction[] = [];
    userOpSender: string;
    sessionKey: Wallet;
    validUntil: number = 0;
    validAfter: number = 0;
    spentAmount: BigNumber = parseEther('0');
    isBuyOrder: boolean = true;
    approveAll: boolean = false;
    merkleProof: string[] = [];
    maxETHSpend: BigNumber = parseEther('0');
    router: string = AddressZero
    token: string = AddressZero
    options?: BuilderOptions

    constructor(
        userOpSender: string,
        sessionKey: Wallet,
    ) {
        this.userOpSender = userOpSender;
        this.sessionKey = sessionKey;
    }

    withApproveAll(approveAll: boolean) {
        this.approveAll = approveAll;
        return this;
    }

    withToken(token: string) {
        this.token = token;
        return this
    }

    withRouter(router: string) {
        this.router = router;
        return this
    }

    withValidUntil(validUntil: number) {
        this.validUntil = validUntil
        return this
    }

    withValidAfter(validAfter: number) {
        this.validAfter = validAfter
        return this
    }

    withSpentAmount(spentAmount: BigNumber) {
        this.spentAmount = spentAmount;
        return this;
    }

    withMaxETHSpend(maxETHSpend: BigNumber) {
        this.maxETHSpend = maxETHSpend;
        return this;
    }

    withMerkleProof(merkleProof: string[]) {
        this.merkleProof = merkleProof;
        return this;
    }

    withPreApproveTx(tx: Transaction) {
        this.transactions = [tx];
        this.isBuyOrder = false;
        return this;
    }

    withBuyTxs(swapTxs: Transaction[]) {
        this.transactions = swapTxs
        this.isBuyOrder = true;
        return this
    }

    withSellTxs(swapTxs: Transaction[]) {
        this.transactions = swapTxs
        this.isBuyOrder = false;
        return this
    }

    withOptions(options: Partial<BuilderOptions>) {
        if (this.options)
            Object.assign(this.options, options)
        else this.options = options
    }

    async build() {
        if (!this.token) {
            throw new Error("No token provided")
        }

        let txnDataAA1: string;

        if (this.transactions.length === 1) {
            const tx = this.transactions[0]
            txnDataAA1 = SmartAccount__factory.createInterface().encodeFunctionData("execute_ncC", [
                tx.to,
                tx.value,
                tx.data
            ]);
        } else {
            const txs = this.transactions
            txnDataAA1 = SmartAccount__factory.createInterface().encodeFunctionData("executeBatch_y6U", [
                txs.map(tx => tx.to),
                txs.map(tx => tx.value),
                txs.map(tx => tx.data)
            ]);
        }

        const userOp = await fillAndSign(
            {
                sender: this.userOpSender,
                callData: txnDataAA1,
                ...this.options,
            },
            this.sessionKey,
            ContractAddress.EntryPoint
        );

        const paddedSig = defaultAbiCoder.encode(
            [
                "uint48",
                "uint48",
                "address",
                "address",
                "address",
                "uint256",
                "uint256",
                "bool",
                "bool",
                "bytes32[]",
                "bytes"
            ],
            [
                this.validUntil,
                this.validAfter,
                this.router,
                this.token,
                this.sessionKey.address,
                this.maxETHSpend,
                this.spentAmount,
                this.approveAll,
                this.isBuyOrder,
                this.merkleProof,
                userOp.signature,
            ]
        );

        const signatureWithModuleAddress = defaultAbiCoder.encode(
            ["bytes", "address"],
            [paddedSig, ContractAddress.SwapSessionKeyManager]
        );
        userOp.signature = signatureWithModuleAddress;

        return userOp;
    }
}