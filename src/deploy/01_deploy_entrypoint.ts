import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log("deployer = ", deployer)
  await deploy("EntryPoint", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true, // Needed for bundler tests to ensure the entrypoint address does not change b/w tests
    autoMine: true,
  });
};

deploy.tags = ["local"];
export default deploy;
