import * as hre from "hardhat";
import { getEntryPoint, getTokenPaymaster } from "../utils/setupHelper";
import { disableToken, enableToken } from "./paymaster-config-token";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";
import { ERC20__factory, TokenPaymaster, TokenPaymaster__factory } from "../../typechain-types";
import { EntryPoint__factory } from "@account-abstraction/contracts";

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
    //const paymaster = await getTokenPaymaster();
    const paymaster = TokenPaymaster__factory.connect("0x075FaF35b3EA69B771CB15Cd9bbd6d5da69b513c", hre.ethers.provider);
    const wrappedNative = await paymaster.wrappedNative();
    console.log(" native token = ", wrappedNative);
    const listTokenSupport = await paymaster.getListTokenSupport();
    console.log(" list = ", listTokenSupport);
    const dex = await paymaster.luminexRouterV1();
    console.log(" address ", dex);
    //    const entryPoint = await getEntryPoint();
    const entryPoint = EntryPoint__factory.connect("0x90cf31349Bc09Fb7eBBcdEbFaB61940030ecd696", await hre.ethers.getSigner(deployer));

    let balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
    if (Number(balanceOfPaymaster) < 0.5) {
        //deposit for paymaster
        await (await entryPoint.depositTo(paymaster.address, { value: parseEther("10") })).wait();
    }
    balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
    console.log(" balance Paymaster in Entrypoint", balanceOfPaymaster);
    let balanceOfDex = formatEther(await hre.ethers.provider.getBalance(dex));
    console.log(" balance Dex in DEX", balanceOfDex);

    const balance2OfPaymaster = formatEther(await hre.ethers.provider.getBalance(paymaster.address));
    console.log(" balance Paymaster in Paymaster", balance2OfPaymaster);

    const erc20 = ERC20__factory.connect("0x1DD8219c8A8f2fF453fd19F775e3dA8c0501E768", hre.ethers.provider);

    console.log(" balance of token in paymaster = ", formatUnits(await erc20.balanceOf(paymaster.address), 6));

    console.log(" balance of token in dex = ", formatUnits(await erc20.balanceOf(dex), 6));

    const confif = await paymaster.tokenPaymasterConfig();

    console.log(" config = ", confif);

    // await updateConfig();
    //await enableToken("0x1DD8219c8A8f2fF453fd19F775e3dA8c0501E768");
}
paymasterDashboard();
