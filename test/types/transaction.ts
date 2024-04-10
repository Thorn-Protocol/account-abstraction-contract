import { BigNumberish, BytesLike } from "ethers";

export interface Transaction {
    to: string,
    value: BigNumberish,
    data: BytesLike
}