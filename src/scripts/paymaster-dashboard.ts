import * as hre from "hardhat";
import { getEntryPoint, getTokenPaymaster } from "../utils/setupHelper";
import { disableToken, enableToken } from "./paymaster-config-token";
import { formatEther, parseEther } from "ethers/lib/utils";

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
    // const countToken = Number(await paymaster.countTokenSupport());
    // for (let i = 0; i < countToken; i++) {
    //     const token = await paymaster.listTokenSupport(i);
    //     console.log(" token ", i, ": ", token);
    // }
    const USDC = "0xB649cF2Fca36CaB5dCd4aFC51cC901a4b3cff4a8";
    const USDT = "0x9DA08dDBCB74e9BDf309C7fa94F3b7AFB3341EB2";
    const ETH = "0xCb4D186B2bE6e3e1fa067Ceb86EC30D6278A3a90";
    // await enableToken(USDC);
    // await enableToken(USDC);
    // await enableToken(USDT);
    // await enableToken(ETH);
    // await disableToken("0x1DD8219c8A8f2fF453fd19F775e3dA8c0501E768");
    // await disableToken("0x9DA08dDBCB74e9BDf309C7fa94F3b7AFB3341EB2");
    // await disableToken("0xCb4D186B2bE6e3e1fa067Ceb86EC30D6278A3a90");
    // await enableToken(USDC);
}
paymasterDashboard();
