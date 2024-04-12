import { ethers } from "hardhat";
const hre = require("hardhat");

import { parseEther } from "ethers/lib/utils";
import {
    TokenPaymaster,
    UniswapHelper as UniswapHelperNamespace,
} from "../../typechain-types/contracts/smart-account/paymasters/TokenPaymaster";


export async function deployEntrypoint() {
    const entryPointContract = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await entryPointContract.deploy();
    await entrypoint.deployed();
    console.log("EntryPoint deployed to:", entrypoint.address);
    return entrypoint;
}

export async function deployECDSARegistryModule() {
    const ECDSARegistryModuleContract = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
    const ECDSARegistryModule = await ECDSARegistryModuleContract.deploy();
    await ECDSARegistryModule.deployed();
    console.log("EcdsaOwnershipRegistryModule deployed to:", ECDSARegistryModule.address); 
}

export async function deploySmartAccountImplementation(entryPointAddress: string) {
    const smartAccountContract = await ethers.getContractFactory("SmartAccount");
    const smartAccountImpl = await smartAccountContract.deploy(entryPointAddress);
    await smartAccountImpl.deployed();
    console.log("SmartAccount deployed to:", smartAccountImpl.address);
    return smartAccountImpl.address;
}

export async function deploySmartAccountFactory(smartAccountImplementationAddress: string) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();

    const smartAccountFactoryContract = await ethers.getContractFactory("SmartAccountFactory");
    const smartAccountFactory = await smartAccountFactoryContract.deploy(smartAccountImplementationAddress, deployer);
    await smartAccountFactory.deployed();
    console.log("SmartAccountFactory deployed to:", smartAccountFactory.address);
}

export async function deployMockToken() {
    const mockTokenContract = await ethers.getContractFactory("MockToken");
    const mockToken = await mockTokenContract.deploy();
    await mockToken.deployed();
    console.log("MockToken deployed to:", mockToken.address);
}

export async function deployPaymaster(entryPointAddress: string) {
    const WETHAddress = "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f";

    // address of a contract specifically designed for retrieving quotes (estimated exchange rates) from PancakeSwap
    const pancakeSwapQuote = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";

    // address of a PancakeSwap router contract
    const pankaceSwapRoute = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";

    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("0.005"),
    };

    const uniswapHelperConfig: UniswapHelperNamespace.UniswapHelperConfigStruct = {
        minSwapAmount: parseEther("0.005"),
        slippage: "0",
    };
    const tokenPaymasterWallet = new ethers.Wallet(process.env.PRIVATE_KEY_TOKEN_PAYMASTER!);


    const paymasterContract = await ethers.getContractFactory("TokenPaymaster");

    const paymaster = await paymasterContract.deploy(
        entryPointAddress,
        WETHAddress,
        pankaceSwapRoute,
        pancakeSwapQuote,
        tokenPaymasterConfig,
        uniswapHelperConfig,
        tokenPaymasterWallet.address,
    );
    await paymaster.deployed();
    console.log("TokenPaymaster deployed to:", paymaster.address);
}

export async function deployBalanceRegistry() {
    const balanceRegistryContract = await ethers.getContractFactory("ConfidentialBalanceRegistry");
    const [signer0] = await ethers.getSigners();
    const balanceRegistry = await balanceRegistryContract.deploy(
        signer0.address,
        signer0.address,
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    );
    await balanceRegistry.deployed();
    console.log("BalanceRegistry deployed to:", balanceRegistry.address);
    return balanceRegistry.address;
}

// export async function deployPrivateErc20(balanceRegistryAddress: string) {
//     const config = {
//         totalSupplyVisible: true,
//         name: "MockPrivateToken",
//         symbol: "MPT",
//         decimals: 18
//     };

//     const privateErc20Contract = await ethers.getContractFactory("PrivateERC20");
//     const privateErc20 = await privateErc20Contract.deploy(
//         config,
//         "0x5FbDB2315678afecb367f032d93F642f64180aa3",
//         balanceRegistryAddress
//     );
//     await privateErc20.deployed();
//     console.log("PrivateERC20 deployed to:", privateErc20.address);
// }


async function main() {
    // LOCAL
    const entryPoint = await deployEntrypoint();
    await deployECDSARegistryModule();
    const smartAccountImpl = await deploySmartAccountImplementation(entryPoint.address);
    await deploySmartAccountFactory(smartAccountImpl);
    await deployMockToken();
    await deployPaymaster(entryPoint.address);
    const balanceRegistryAddress = await deployBalanceRegistry();
    // await deployPrivateErc20(balanceRegistryAddress);


    // // TESTNET
    // const entryPointAddress = "0xC17D1247914d3B0B2207E21bc434150fA740B939";
    // await deployPaymaster(entryPointAddress);
    // await deployPrivateErc20();
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});