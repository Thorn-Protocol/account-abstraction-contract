import { ethers } from "ethers";

export function callDataCost(data: string): number {
    return ethers.utils
        .arrayify(data)
        .map((x) => (x === 0 ? 4 : 16))
        .reduce((sum, x) => sum + x);
}