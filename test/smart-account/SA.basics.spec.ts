import { deployments, ethers } from "hardhat";
import { makeEcdsaModuleUserOp, makeEcdsaModuleUserOpWithPaymaster } from "../utils/userOp";
import { encodeTransfer } from "../utils/testUtils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getEntryPoint, getSmartAccountImplementation, getSmartAccountFactory, getSmartAccountWithModule, getEcdsaOwnershipRegistryModule, getMockToken } from "../utils/setupHelper";




describe("Modular Smart Account Basics", async () => {
    let deployer: SignerWithAddress,
      smartAccountOwner: SignerWithAddress,
      charlie: SignerWithAddress;
  
   // console.log( await ethers.getSigners() );
    // beforeEach(async function () {
    //  [deployer] = await ethers.getSigners();
    // });
    
    const setupTests =  async () => {
  
      [deployer] = await ethers.getSigners();
      console.log("Deployer Address = ", deployer.address) 
      //await deployments.fixture();
      const mockToken = await getMockToken();
      const ecdsaModule = await getEcdsaOwnershipRegistryModule();
      console.log("ecdsaModule = ", ecdsaModule.address);
      console.log("mockToken = ", mockToken.address);
      const EcdsaOwnershipRegistryModule = await ethers.getContractFactory(
        "EcdsaOwnershipRegistryModule"
      );
    
      const ecdsaOwnershipSetupData =
        EcdsaOwnershipRegistryModule.interface.encodeFunctionData(
          "initForSmartAccount",
          [await deployer.getAddress()]
        );
      console.log(" data = ", ecdsaOwnershipSetupData);
      const smartAccountDeploymentIndex = 0;
      const userSA = await getSmartAccountWithModule(
        ecdsaModule.address,
        ecdsaOwnershipSetupData,
        smartAccountDeploymentIndex
      );
      console.log(" userSA = ", userSA.address);
        
      await deployer.sendTransaction({
        to: userSA.address,
        value: ethers.utils.parseEther("10"),
      });
      console.log("AA address = ", userSA.address);
      
      await mockToken.mint(userSA.address, ethers.utils.parseEther("1000000"));
  
      return {
        entryPoint: await getEntryPoint(),
        smartAccountImplementation: await getSmartAccountImplementation(),
        smartAccountFactory: await getSmartAccountFactory(),
        mockToken: mockToken,
        ecdsaModule: ecdsaModule,
        userSA: userSA,
      };
    };
  
    it("Can send an ERC20 Transfer userOp", async () => {
      const { entryPoint, mockToken, userSA, ecdsaModule } = await setupTests();
  
      const charlieTokenBalanceBefore = await mockToken.balanceOf(
        charlie.address
      );
      const tokenAmountToTransfer = ethers.utils.parseEther("0.5345");
  
      const userOp = await makeEcdsaModuleUserOp(
        "execute_ncC",
        [
          mockToken.address,
          ethers.utils.parseEther("0"),
          encodeTransfer(charlie.address, tokenAmountToTransfer.toString()),
        ],
        userSA.address,
        smartAccountOwner,
        entryPoint,
        ecdsaModule.address,
        {
          preVerificationGas: 50000,
        }
      );
  
      // await environment.sendUserOperation(userOp, entryPoint.address);
  
      // expect(await mockToken.balanceOf(charlie.address)).to.equal(
      //   charlieTokenBalanceBefore.add(tokenAmountToTransfer)
      // );
    });
  
    it("Can send a Native Token Transfer userOp", async () => {
      const { entryPoint, userSA, ecdsaModule } = await setupTests();
  
      const charlieBalanceBefore = await charlie.getBalance();
      const amountToTransfer = ethers.utils.parseEther("0.5345");
  
      const userOp = await makeEcdsaModuleUserOp(
        "execute_ncC",
        [charlie.address, amountToTransfer, "0x"],
        userSA.address,
        smartAccountOwner,
        entryPoint,
        ecdsaModule.address,
        {
          preVerificationGas: 50000,
        }
      );
  
      // await environment.sendUserOperation(userOp, entryPoint.address);
      // expect(await charlie.getBalance()).to.equal(
      //   charlieBalanceBefore.add(amountToTransfer)
      // );
    });
});
    // TODO: This test fails with the message paymaster uses banned opcode: BASEFEE
  