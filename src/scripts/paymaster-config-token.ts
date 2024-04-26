import * as hre from "hardhat";
import { getTokenPaymaster } from "../utils/setupHelper";

export async function enableToken(address: string) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const paymaster = await getTokenPaymaster();
    console.log("enabling........");
    const tx = await paymaster.addERC20Support(address);
    const listTokenSupport = await paymaster.getListTokenSupport();
    console.log(" list after = ", listTokenSupport);
}
export async function disableToken(address: string) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const paymaster = await getTokenPaymaster();
    console.log("disabling........");
    const tx = await paymaster.removeERC20Support(address);
    const listTokenSupport = await paymaster.getListTokenSupport();
    console.log(" list after = ", listTokenSupport);
}
