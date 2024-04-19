# account-abstraction-contract

### Clone respository and setup environment
```
$ git clone https://github.com/Thorn-Protocol/account-abstraction-contract.git
$ cd account-abstraction-contract 
$ npm install --save-dev --force
```
### Config url and ENVIRONMENT_VARIABLE in .env
<!-- TODO -->

## Table of contents 
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Deployment](#deployment)
4. [Testing and Development](#testing-and-development)

## Overview 
Account Abstraction Contract for Thorn Protocol on Oasis Sapphire network.

## Architecture
- EntryPoint contract: The EntryPoint contract acts as the gateway for interactions with the account abstraction system. It facilitates the creation and management of smart accounts, providing functions for deploying new accounts, updating settings, and executing transactions.
- SmartAccount contract: The SmartAccount contract is the core component of the account abstraction system. It represents programmable entities capable of holding assets, executing transactions, and interacting with other contracts autonomously. This contract defines account behavior, including transaction handling and state management.
- SmartAccountFactory contract: The SmartAccountFactory contract dynamically deploys and initializes new smart accounts. It serves as a factory pattern, enabling users to create instances of the SmartAccount contract with customizable parameters, such as initial balances or contract code.
- TokenPaymaster contract: The TokenPaymaster contract facilitates token transfers and manages payments within the account abstraction system. It helps to ensure that smart accounts have sufficient funds to execute transactions, pays gas in supported ERC20 tokens other than native token, and automatically deposits tokens from user's account to entrypoint to pay gas in UserOp, providing a seamless user experience.

## Deployment

**Compile contract**  before deploying:
```
npx hardhat compile
```
**Deploy  8 contracts** in the following order: 
```
npx hardhat run src/deploy/01_deploy_entrypoint.ts
npx hardhat run src/deploy/02_deploy_ECDSA_Registry_Module.ts
npx hardhat run src/deploy/03_deploy_sa_implementation.ts
npx hardhat run src/deploy/04_deploy_sa_factory.ts
npx hardhat run src/deploy/05_deploy_mockToken.ts
npx hardhat run src/deploy/06_deploy_wrapped_token.ts
npx hardhat run src/deploy/07_deploy_mock_luminexRouter.ts
npx hardhat run src/deploy/07_deploy_token_paymaster.ts
```

## Testing and Development

### Organization and Workflow

### Running the Tests
To run tests : 

```
npx hardhat test tests/<test file name>
```