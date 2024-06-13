import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getEntryPoint, getLuminexRouterV1, getMockWrappedNative } from "../utils/setupHelper";
import { TokenPaymaster } from "../../typechain-types";
import { parseEther } from "ethers/lib/utils";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const entryPoint = await getEntryPoint();
    const wrappedNative = await getMockWrappedNative();
    const luminexRouterV1 = await getLuminexRouterV1();
    //get from https://docs.illuminex.xyz/illuminex-docs/misc/contracts
    const privateWrapperFactory = "0xb539f1D01A437C7f30cAfC994e918F952dDc0bA2";
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("10"),
    };
    // await deploy("TokenPaymaster", {
    //     from: deployer,
    //     args: [entryPoint.address, wrappedNative.address, luminexRouterV1.address, privateWrapperFactory, tokenPaymasterConfig, deployer],
    //     log: true,
    //     deterministicDeployment: true,

    //     autoMine: true,
    // });
};
deploy.tags = ["sapphire-mainnet"];
export default deploy;
