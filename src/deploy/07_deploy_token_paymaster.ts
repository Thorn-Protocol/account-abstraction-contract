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

  const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
    refundPostopCost: 40000,
    minSwapAmount: parseEther("1"),
  };

  await deploy("TokenPaymaster", {
    from: deployer,
    args: [entryPoint.address, wrappedNative.address, luminexRouterV1.address, tokenPaymasterConfig, deployer],
    log: true,
    deterministicDeployment: true,
    //skipIfAlreadyDeployed: true,
    autoMine: true,
  });
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet", "sapphire-mainnet"];
export default deploy;
