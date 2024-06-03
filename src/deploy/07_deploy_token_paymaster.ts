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
    console.log(" deploying TokenPaymaster with entryPoint: ", entryPoint.address);
    const wrappedNative = await getMockWrappedNative();
    console.log(" deploying TokenPaymaster with wrappedNative: ", wrappedNative.address);
    const luminexRouterV1 = await getLuminexRouterV1();
    console.log(" deploying TokenPaymaster with luminexRouterV1: ", luminexRouterV1.address);
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
        refundPostopCost: 40000,
        minSwapAmount: parseEther("1"),
    };

    await deploy("TokenPaymaster", {
        from: deployer,
        args: [entryPoint.address, wrappedNative.address, luminexRouterV1.address, tokenPaymasterConfig, deployer],
        log: true,
        deterministicDeployment: true,

        autoMine: true,
    });
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet"];
export default deploy;
