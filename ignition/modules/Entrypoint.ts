const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const EntryPointModule = buildModule("Apollo",(m: any) => {
  const entryPoint = m.contract("EntryPoint");
  console.log("entrypoint = ", entryPoint)
  return { entryPoint};
})