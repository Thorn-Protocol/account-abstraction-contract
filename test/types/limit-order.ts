import { BigNumberish } from "ethers";

export interface LimitOrder {
    _id: string;
    telegramId: number;
    smartAccountsOwner: string;
    router: string;
    token: string;
    ethSpend: BigNumberish;
    triggeredByPrice: boolean;
    isBuyOrder: boolean;
    triggeredGt: boolean;
    triggerValue: BigNumberish;
    slippage: number;
    expiryDate: number;
    participatingWallets: string[];
}