import { HardhatUserConfig } from "hardhat/config";
import "@oasisprotocol/sapphire-hardhat";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-dependency-compiler";
// import "hardhat-tracer";
import dotenv from "dotenv";
dotenv.config();

const { mnemonic } = require('./secrets.json');


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
    // defaultNetwork: "bsc-testnet",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            accounts: TEST_HDWALLET,
            tags: ["hardhat"],
        },
        // sapphire: {
        //     url: "https://sapphire.oasis.io",
        //     chainId: 0x5afe,
        //     accounts,
        // },
        // "sapphire-testnet": {
        //     url: "https://testnet.sapphire.oasis.dev",
        //     chainId: 0x5aff,
        //     accounts,
        //     live: true,
        //     tags: ["testnet"],
        // },
        // "sapphire-localnet": {
        //     url: "http://localhost:8545",
        //     tags: ["testnet"],
        //     accounts: TEST_HDWALLET,
        //     chainId: 0x5afd,
        //     // gasPrice: 1,
        //     blockGasLimit: 1e9,
        // },
        "bsc-testnet": {
            url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
            chainId: 97,
            tags: ["testnet"],
            gasPrice: 20000000000,
            accounts: { mnemonic: mnemonic }
        },

        // folked_oasis: {
        //     tags: ["forked-oasis"],
        //     url: "http://127.0.0.1:9000",
        //     accounts,
        //     live: false,
        //     chainId: 31337,
        // },
    },
};

export default config;