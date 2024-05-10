import * as hre from "hardhat";
import { getEntryPoint, getTokenPaymaster } from "../utils/setupHelper";
import { disableToken, enableToken } from "./paymaster-config-token";
import { formatEther, parseEther } from "ethers/lib/utils";
import { TokenPaymaster, TokenPaymaster__factory } from "../../typechain-types";
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
  const paymaster = TokenPaymaster__factory.connect("0x1376Be43d4FCfb362474EA6acF80Bd6E982E25b7", hre.ethers.provider);
  const wrappedNative = await paymaster.wrappedNative();
  console.log(" native token = ", wrappedNative);
  const listTokenSupport = await paymaster.getListTokenSupport();
  console.log(" list = ", listTokenSupport);

  //    const entryPoint = await getEntryPoint();
  const entryPoint = EntryPoint__factory.connect("0xf0B1274232343EDe4960Eb6Cfd7137Ae55D3751B", await hre.ethers.getSigner(deployer));

  let balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
  if (Number(balanceOfPaymaster) < 0.5) {
    //deposit for paymaster
    await (await entryPoint.depositTo(paymaster.address, { value: parseEther("10") })).wait();
  }
  balanceOfPaymaster = formatEther(await entryPoint.balanceOf(paymaster.address));
  console.log(" balance Paymaster in Entrypoint", balanceOfPaymaster);

  // await updateConfig();
  await enableToken("0x1DD8219c8A8f2fF453fd19F775e3dA8c0501E768");
}
paymasterDashboard();
