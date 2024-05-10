import { ethers } from "hardhat";
import { TokenPaymaster } from "../../typechain-types";
import { parseEther } from "ethers/lib/utils";

export async function deployPaymaster() {
  const paymasterContract = await ethers.getContractFactory("TokenPaymaster");
  console.log("Starting deployment TokenPaymaster...");

  const entryPoint = "0xf0B1274232343EDe4960Eb6Cfd7137Ae55D3751B";

  const wrappedNative = "0xB759a0fbc1dA517aF257D5Cf039aB4D86dFB3b94";

  const luminexRouterV1 = "0x0E593fB569c284ae8AE597211F222BCE4dE7aE57";

  const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
    refundPostopCost: 40000,
    minSwapAmount: parseEther("1"),
  };

  const owner = "0x2F459030f95Be9CeeA722cD207F323bd648F65D0";

  const tokenPaymaster = await paymasterContract.deploy(entryPoint, wrappedNative, luminexRouterV1, tokenPaymasterConfig, owner);

  await tokenPaymaster.deployed();

  console.log("Contract deployed to address:", tokenPaymaster.address);
}

deployPaymaster();
