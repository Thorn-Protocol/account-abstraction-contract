// const hre = require("hardhat");

// const FACTORY_NONCE = 1;
// const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
// const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
// const PM_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// async function main() {
//     const entryPoint = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);

//     const sender = await hre.ethers.getCreateAddress({
//         from: FACTORY_ADDRESS,
//         nonce: FACTORY_NONCE,
//     });

//     const AccountFactory = await hre.ethers.getContractFactory("AccountFactory");
//     const [signer0] = await hre.ethers.getSigners();
//     const address0 = await signer0.getAddress();
//     console.log(`sender: ${sender}`);
//     const initCode = 
//         "0x"
//         // FACTORY_ADDRESS +
//         // AccountFactory.interface.encodeFunctionData("createAccount", [address0]).slice(2);
        
//     // prefund 
//     await entryPoint.depositTo(PM_ADDRESS, {
//         value: hre.ethers.parseEther("100"),
//     });
    
//     const Account = await hre.ethers.getContractFactory("Account");
    
//     // const sig = await signer0.signMessage(
//     //     hre.ethers.getBytes(hre.ethers.id("wee"))
//     // );

//     const userOp = {
//         sender, // smart account address
//         // auto get nonce. key is for txn (with different keys) to not be related to each other in order
//         nonce: await entryPoint.getNonce(sender, 0),
//         initCode,
//         // method of the smart account to call
//         callData: Account.interface.encodeFunctionData("execute"),
//         callGasLimit: 400_000,
//         verificationGasLimit: 800_000,
//         preVerificationGas: 100_000,
//         maxFeePerGas: hre.ethers.parseUnits("10", "gwei"),
//         maxPriorityFeePerGas: hre.ethers.parseUnits("5", "gwei"),
//         // paymasterAndData: "0x",
//         paymasterAndData: PM_ADDRESS,
//         signature: "0x",
//     };

//     const userOpHash = await entryPoint.getUserOpHash(userOp);
//     userOp.signature = await signer0.signMessage(hre.ethers.getBytes(userOpHash));
    
//     // const Test = await hre.ethers.getContractFactory("Test");
//     // const test = await Test.deploy(userOpHash, userOp.signature);

//     const tx = await entryPoint.handleOps([userOp], address0);
//     const receipt = await tx.wait();
//     console.log(receipt);

// }

// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });
