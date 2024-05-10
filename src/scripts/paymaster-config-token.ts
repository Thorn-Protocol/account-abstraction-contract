import * as hre from "hardhat";
import { getTokenPaymaster } from "../utils/setupHelper";
import { TokenPaymaster__factory } from "../../typechain-types";

export async function enableToken(address: string) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  //const paymaster = await getTokenPaymaster();
  const paymaster = TokenPaymaster__factory.connect("0x1376Be43d4FCfb362474EA6acF80Bd6E982E25b7", hre.ethers.provider);
  const wallet = await hre.ethers.getSigner(deployer);
  console.log("enabling........");
  const tx = await (await paymaster.connect(wallet).addERC20Support(address)).wait();
  const listTokenSupport = await paymaster.getListTokenSupport();
  console.log(" list after = ", listTokenSupport);
}
export async function disableToken(address: string) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const paymaster = await getTokenPaymaster();
  console.log("disabling........");
  const tx = await (await paymaster.removeERC20Support(address)).wait();
  const listTokenSupport = await paymaster.getListTokenSupport();
  console.log(" list after = ", listTokenSupport);
}
