import { ethers } from "hardhat";

export async function deployEntrypoint() {
    const entryPointContract = await ethers.getContractFactory("EntryPoint");
    console.log("Starting deployment...");
    const entrypoint = await entryPointContract.deploy();
    await entrypoint.deployed();
    console.log("Contract deployed to:", entrypoint.address);
}
deployEntrypoint();
