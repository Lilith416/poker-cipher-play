import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("hl:address", "Prints the EncryptedHighLow deployment address").setAction(
  async (_args: TaskArguments, hre) => {
    const { deployments } = hre;
    const deployment = await deployments.get("EncryptedHighLow");
    console.log(`EncryptedHighLow address: ${deployment.address}`);
  },
);

task("hl:create-game", "Create a high-low match with encrypted secret number")
  .addOptionalParam("address", "Override the EncryptedHighLow contract address")
  .addParam("number", "Secret number between 1 and 10")
  .addParam("minstake", "Minimum stake in wei for challengers (>= 1e15)")
  .addParam("duration", "Duration in seconds until the round ends (>= 60)")
  .addParam("reward", "Reward pool in wei funded by creator")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const secretNumber = parseInt(args.number, 10);
    if (Number.isNaN(secretNumber) || secretNumber < 1 || secretNumber > 10) {
      throw new Error("Argument --number must be between 1 and 10");
    }

    const minStake = BigInt(args.minstake);
    const duration = parseInt(args.duration, 10);
    const reward = BigInt(args.reward);

    if (Number.isNaN(duration) || duration < 60) {
      throw new Error("Argument --duration must be >= 60 seconds");
    }

    await fhevm.initializeCLIApi();

    const deployment = args.address
      ? { address: args.address }
      : await deployments.get("EncryptedHighLow");

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("EncryptedHighLow", deployment.address);

    const endTime = BigInt(Math.floor(Date.now() / 1000) + duration);
    const enc = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add8(secretNumber)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .createGame(enc.handles[0], enc.inputProof, minStake, endTime, reward, { value: reward });

    console.log(`Submitted createGame tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`createGame confirmed in block ${receipt?.blockNumber}`);
  });

task("hl:join-game", "Join a match with an encrypted guess")
  .addOptionalParam("address", "Override the EncryptedHighLow contract address")
  .addParam("id", "Game identifier")
  .addParam("big", "Set to true to bet on big (6-10), false for small (1-5)")
  .addParam("amount", "Stake amount in wei to send with the transaction")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const gameId = BigInt(args.id);
    const stake = BigInt(args.amount);
    const wantsBig = args.big === "true" || args.big === "1";

    await fhevm.initializeCLIApi();

    const deployment = args.address
      ? { address: args.address }
      : await deployments.get("EncryptedHighLow");

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("EncryptedHighLow", deployment.address);

    const enc = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addBool(wantsBig)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .joinGame(gameId, enc.handles[0], enc.inputProof, { value: stake });

    console.log(`Submitted joinGame tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`joinGame confirmed in block ${receipt?.blockNumber}`);
  });

task("hl:request-reveal", "Trigger settlement for a finished match")
  .addOptionalParam("address", "Override the EncryptedHighLow contract address")
  .addParam("id", "Game identifier")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const gameId = BigInt(args.id);
    const deployment = args.address
      ? { address: args.address }
      : await deployments.get("EncryptedHighLow");

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("EncryptedHighLow", deployment.address);
    const tx = await contract.connect(signer).requestReveal(gameId);
    console.log(`Submitted requestReveal tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`requestReveal confirmed in block ${receipt?.blockNumber}`);
  });

task("hl:decrypt-secret", "Decrypt the stored secret number handle for debugging")
  .addOptionalParam("address", "Override the EncryptedHighLow contract address")
  .addParam("id", "Game identifier")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = args.address
      ? { address: args.address }
      : await deployments.get("EncryptedHighLow");

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("EncryptedHighLow", deployment.address);
    const secretHandle = await contract.getEncryptedSecret(args.id);

    const clear = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      secretHandle,
      deployment.address,
      signer,
    );
    console.log(`Decrypted secret number: ${clear}`);
  });

