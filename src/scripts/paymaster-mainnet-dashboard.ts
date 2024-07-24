import * as hre from "hardhat";
import { getEntryPoint, getTokenPaymaster } from "../utils/setupHelper";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";
import { ERC20__factory, TokenPaymaster, TokenPaymaster__factory } from "../../typechain-types";
import { EntryPoint__factory } from "@account-abstraction/contracts";
import { ethers } from "hardhat";

const tokenPaymasterAddress = process.env.TOKEN_PAYMASTER!;
const entrypointAddress = process.env.ENTRY_POINT!;

const paymaster = TokenPaymaster__factory.connect(tokenPaymasterAddress, hre.ethers.provider);
const entryPoint = EntryPoint__factory.connect(entrypointAddress, hre.ethers.provider);

export async function enableToken(address: string) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const wallet = await hre.ethers.getSigner(deployer);
    console.log("enabling........");
    const tx = await (await paymaster.connect(wallet).addERC20Support(address)).wait();
}

// async function withdrawEntrypoint() {
//     await paymaster.connect(deployer).withdrawEthFromEntryPoint(deployer.address, parseEther("9.9"));
// }

export async function disableToken(address: string) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const wallet = await hre.ethers.getSigner(deployer);
    console.log("disabling........");
    const tx = await (await paymaster.connect(wallet).removeERC20Support(address)).wait();
}

async function getDEXInfo() {
    const dex = await paymaster.luminexRouterV1();
}

async function getConfigPaymaster() {
    let listTokenSupport = await paymaster.getListTokenSupport();
    const native = await paymaster.wrappedNative();
    listTokenSupport = [native, ...listTokenSupport];
    const config = await paymaster.tokenPaymasterConfig();
    console.log(" listTokenSupport = ", listTokenSupport);
    console.log(" config : refund opCost ", config.refundPostopCost);
    console.log(" config : minSwapAmount ", Number(formatEther(config.minSwapAmount)));
}

async function updateConfig() {
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("50"),
    };
    const paymaster = await getTokenPaymaster();
    const tx = await (await paymaster.setTokenPaymasterConfig(tokenPaymasterConfig)).wait();
    const respone = await paymaster.tokenPaymasterConfig();
    console.log(" config after update :: ", respone);
}

async function paymasterDashboard() {
    const { deployments } = hre;
    const [deployer] = await ethers.getSigners();
    const dex = await paymaster.luminexRouterV1();
    console.log(" address luminexRoute ", dex);

    let balanceOfPaymaster = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));

    if (Number(balanceOfPaymaster) < 0.5) {
        await (await entryPoint.connect(deployer).depositTo(paymaster.address, { value: parseEther("10") })).wait();
    }

    balanceOfPaymaster = Number(formatEther(await entryPoint.balanceOf(paymaster.address)));
    console.log(" balance Paymaster in Entrypoint", balanceOfPaymaster);
    const balance2OfPaymaster = formatEther(await hre.ethers.provider.getBalance(paymaster.address));
    console.log(" balance native in Paymaster", balance2OfPaymaster);
    const erc20 = ERC20__factory.connect("0xf170d8b2e7280A495aF181aDE4c18f67bEfD9941", hre.ethers.provider);
    console.log(" balance of token in paymaster = ", Number(formatUnits(await erc20.balanceOf(paymaster.address), 6)));
    console.log(" balance of token in dex = ", Number(formatUnits(await erc20.balanceOf(dex), 6)));

    //  await enableToken(erc20.address);
    await disableToken(erc20.address);
    await enableToken("0xeC240a739D04188D83E9125CECC2ea88fABd9B08");
    await getConfigPaymaster();
}
paymasterDashboard();
