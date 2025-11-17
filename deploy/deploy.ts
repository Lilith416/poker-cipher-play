import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const game = await deploy("EncryptedHighLow", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedHighLow contract: `, game.address);
};
export default func;
// func.id = "deploy_encrypted_high_low"; // id required to prevent reexecution - commented out to force redeploy
func.tags = ["EncryptedHighLow"];
