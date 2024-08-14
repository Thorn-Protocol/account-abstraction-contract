import { ethers } from "hardhat";
import { fillAndSign } from "./userOp";
import { Signer } from "ethers";
import { EntryPoint } from "@account-abstraction/contracts";

export async function makeAutoTradingUserOp(
    functionName: string,
    functionParams: any[],
    userOpSender: string,
    userOpSigner: Signer,
    entryPoint: EntryPoint,
    moduleAddress: string,
    options?: {
        preVerificationGas?: number;
    },
    nonceKey = 0
) {
    const SmartAccount = await ethers.getContractFactory("SmartAccount");

    const txnDataAA1 = SmartAccount.interface.encodeFunctionData(functionName, functionParams);

    const userOp = await fillAndSign(
        {
            sender: userOpSender,
            callData: txnDataAA1,
            ...options,
        },
        userOpSigner,
        entryPoint,
        "nonce",
        true,
        nonceKey,
        0
    );

    const signatureWithModuleAddress = ethers.utils.defaultAbiCoder.encode(
        ["bytes", "address"],
        [userOp.signature, moduleAddress]
    );

    userOp.signature = signatureWithModuleAddress;

    return userOp;
}
