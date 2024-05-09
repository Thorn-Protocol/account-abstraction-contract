import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getEntryPoint } from "../utils/setupHelper";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const entryPoint = await getEntryPoint();
  console.log(" deploying SmartAccount with entryPoint: ", entryPoint.address);
  await deploy("SmartAccount", {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    deterministicDeployment: true,
    autoMine: true,
  });
};

deploy.tags = ["local", "sapphire-testnet", "sapphire-localnet", "sapphire-mainnet"];
export default deploy;
