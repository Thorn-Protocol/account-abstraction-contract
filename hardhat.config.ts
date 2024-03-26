import { HardhatUserConfig } from "hardhat/config";
import '@oasisprotocol/sapphire-hardhat';

import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import '@typechain/hardhat';

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
    tests: "test"
  },
  namedAccounts: {
    deployer: 0,
    smartAccountOwner: 1,
    alice: 2,
    charlie: 3,
    sessionKey: 4,
  },

  solidity:{
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },

  networks: {
    hardhat: { 
      chainId: 1337,
    },
    'sapphire': {
      url: 'https://sapphire.oasis.io',
      chainId: 0x5afe,
      accounts,
    },
    'sapphire-testnet': {
      url: 'https://testnet.sapphire.oasis.dev',
      chainId: 0x5aff,
      accounts,
    },
    'sapphire-localnet': { 
      url: 'http://localhost:8545',
      chainId: 0x5afd,
      accounts : TEST_HDWALLET,
    },
  }
};

export default config;


