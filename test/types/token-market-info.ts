import { BigNumberish } from "ethers";

export type Pool = {
    name: 'Uniswap V3' | 'Camelot V3' | 'Sushiswap';
    address: string;
    liquidity: string;
    fee?: BigNumberish;
    feeZto?: BigNumberish;
    feeOtz?: BigNumberish;
    sqrtPriceX96?: string;
    ethReserve?: string;
    tokenReserve?: string;
}

export interface UniV3Pool {
    name: 'Uniswap V3';
    address: string;
    fee: 100 | 500 | 3000 | 10000;
    liquidity: string;
    sqrtPriceX96: string;
}

export interface CamelotV3Pool {
    name: 'Camelot V3';
    address: string;
    feeZto: BigNumberish;
    feeOtz: BigNumberish;
    liquidity: string;
    sqrtPriceX96: string;
}

export interface SushiswapPool {
    name: 'Sushiswap';
    address: string;
    fee: 3000;
    liquidity: string;
    ethReserve: string;
    tokenReserve: string;
}

export default interface TokenMarketInfo {
    address: string;
    mostLiquidPool: Pool;
    marketCap: string;
    priceETH: string;
    priceUSDC: string;
}
