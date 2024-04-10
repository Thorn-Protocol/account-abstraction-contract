import { hexConcat, hexZeroPad, hexlify, keccak256 } from "ethers/lib/utils";
import { BigNumber, BigNumberish } from "ethers";

export interface Approval {
    smartAccountsOwner: string,
    smartAccounts: string[],
    telegramId: number,
    tokens: string[],
    maxETHSpend: BigNumberish,
    locked: boolean,
    connected: boolean
}


export function calculateTokenLeaf(smartAccount: string, sessionPublicKey: string, token: string, router: string, maxETHSpend: BigNumberish) {
    return keccak256(hexConcat([
        hexZeroPad(hexlify(0), 6),
        hexZeroPad(hexlify(0), 6),
        hexZeroPad(token, 20),
        hexZeroPad(hexlify(sessionPublicKey), 20),
        hexZeroPad(hexlify(smartAccount), 20),
        hexZeroPad(hexlify(router), 20),
        hexZeroPad(BigNumber.from(maxETHSpend).toHexString(), 32),
    ]));
}

export function calculateAllTokensLeaf(smartAccount: string, sessionPublicKey: string, router: string, maxETHSpend: BigNumberish) {
    return keccak256(hexConcat([
        hexZeroPad(hexlify(0), 6),
        hexZeroPad(hexlify(0), 6),
        hexZeroPad(hexlify(sessionPublicKey), 20),
        hexZeroPad(hexlify(smartAccount), 20),
        hexZeroPad(hexlify(router), 20),
        hexZeroPad(BigNumber.from(maxETHSpend).toHexString(), 32),
    ]));
}