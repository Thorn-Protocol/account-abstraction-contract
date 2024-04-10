import { ethers } from "ethers";
import { hexZeroPad, parseEther, parseUnits } from "ethers/lib/utils";

export const FEE_RATE = parseUnits('0.0025', 6);
export const FEE_RATE_PRECISION = parseUnits('1', 6);
export const HALF_FEE_RATE_PRESCISION = parseUnits('5', 5);
export const FEE_THRESHOLD = parseEther('0.0025');
export const FEE_RECIPIENT = '0x2c9a413bE3eDCc98c4a14E5469bd324770bDF666'
export const AddressZero = hexZeroPad('0x0c', 20);
export const ChainId = 31337
export const Provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL)