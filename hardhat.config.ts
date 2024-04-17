import { HardhatUserConfig } from "hardhat/config";
import "@oasisprotocol/sapphire-hardhat";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-dependency-compiler";
// import "hardhat-tracer";
import dotenv from "dotenv";
dotenv.config();

const TEST_HDWALLET = {
    mnemonic: "test test test test test test test test test test test junk",
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 20,
    passphrase: "",
};

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : TEST_HDWALLET;

const config: HardhatUserConfig = {
    paths: {
        artifacts: "artifacts",
        cache: "cache",
        deploy: "src/deploy",
        sources: "contracts",
        tests: "test",
    },
    namedAccounts: {
        deployer: 0,
        smartAccountOwner: 1,
        alice: 2,
        charlie: 3,
        sessionKey: 4,
    },
    dependencyCompiler: {
        paths: [],
    },

    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: { enabled: true, runs: 800 },
                    viaIR: true,
                },
            },
        ],
    },
    // defaultNetwork: "sapphire-testnet",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            accounts: TEST_HDWALLET,
            tags: ["hardhat"],
            initialBaseFeePerGas: 100e9,
        },
        "sapphire-mainnet": {
            url: "https://sapphire.oasis.io",
            chainId: 0x5afe,
            accounts,
            live: true,
            tags: ["sapphire-mainnet"],
        },
        "sapphire-testnet": {
            url: "https://testnet.sapphire.oasis.dev",
            chainId: 0x5aff,
            accounts,
            live: true,
            tags: ["sapphire-testnet"],
        },
        "sapphire-localnet": {
            url: "http://localhost:8545",

            accounts: TEST_HDWALLET,
            chainId: 0x5afd,
            tags: ["sapphire-localnet"],
        },
        "bsc-testnet": {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            accounts,
            live: true,
            chainId: 97,
            tags: ["bsc-testnet"],
        },
    },
};

export default config;
