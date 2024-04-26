import * as hre from "hardhat";
import { getEntryPoint, getLuminexRouterV1, getTokenPaymaster } from "../utils/setupHelper";
import { disableToken, enableToken } from "./paymaster-config-token";
import { formatEther, parseEther } from "ethers/lib/utils";

async function paymasterDashboard() {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const mockDex = await getLuminexRouterV1();
    const amountROSE = formatEther(await hre.ethers.provider.getBalance(mockDex.address));
    console.log(" mock DEX address: ", mockDex.address);
    console.log(" ROSE balance in DEX:", amountROSE.toString());
}
paymasterDashboard();
