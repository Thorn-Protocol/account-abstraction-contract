import { EntryPoint } from "@account-abstraction/contracts";
import { getEntryPoint } from "../src/utils/setupHelper";
import { ethers, getNamedAccounts } from "hardhat";
import { Wallet } from "ethers";

describe("Test flow ", () => {
    let alice: string;
    let bob: string;
    const provider = ethers.provider;

    const setupTest = async () => {
        const accounts = await getNamedAccounts();
        alice = "126e5c831e069d41c266d2b66411bd2035f18dc4d91d1655008d67e027366ad6";
        bob = "126e5c831e069d41c266d2b66411bd2035f18dc4d91d1655008d67e027366ad7";

        const ecdsaModule = await getEcdsaOwnershipRegistryModule();
        const EcdsaOwnershipRegistryModule = await ethers.getContractFactory("EcdsaOwnershipRegistryModule");
    };
});
