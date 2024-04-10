import { BigNumberish } from "ethers";

export interface Fee {
    smartAccount: string,
    currentAccumulatedFee: BigNumberish
}