import * as hre from "hardhat";
import { getEntryPoint, getTokenPaymaster } from "../utils/setupHelper";
import { disableToken, enableToken } from "./paymaster-config-token";
import { formatEther, parseEther } from "ethers/lib/utils";
import { TokenPaymaster } from "../../typechain-types";

async function updateConfig() {
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("5"),
    };
    const paymaster = await getTokenPaymaster();

    const tx = await (await paymaster.setTokenPaymasterConfig(tokenPaymasterConfig)).wait();

    const data = await paymaster.tokenPaymasterConfig();
    console.log(" data = ", data);
}

async function paymasterDashboard() {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const paymaster = await getTokenPaymaster();
    const wrappedNative = await paymaster.wrappedNative();
    console.log(" native token = ", wrappedNative);
    const listTokenSupport = await paymaster.getListTokenSupport();
    console.log(" list = ", listTokenSupport);

    const entryPoint = await getEntryPoint();
    let balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
    if (Number(balanceOfPaymaster) < 0.5) {
        //deposit for paymaster
        await (await entryPoint.depositTo(paymaster.address, { value: parseEther("10") })).wait();
    }
    balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
    console.log(" balance Paymaster in Entrypoint", balanceOfPaymaster);

    // await updateConfig();
}
paymasterDashboard();
