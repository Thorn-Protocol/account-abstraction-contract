import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getMockWrappedNative } from "../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const wrappedNative = await getMockWrappedNative();

  await deploy("MockLuminexRouterV1", {
    from: deployer,
    args: [wrappedNative.address],
    log: true,
    //deterministicDeployment: true,
    skipIfAlreadyDeployed: true,
    autoMine: true,
  });
};

deploy.tags = ["hardhat", "sapphire-localnet", "sapphire-testnet"];
export default deploy;
