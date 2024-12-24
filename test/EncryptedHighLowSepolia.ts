import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { EncryptedHighLow } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  creator: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

const ONE_ETHER = ethers.parseEther("1");
const MIN_STAKE = ethers.parseEther("0.001");

function generateHash(secretNumber: number, salt: string): string {
  return ethers.keccak256(ethers.solidityPacked(["uint8", "string"], [secretNumber, salt]));
}

async function getCurrentBlockTime(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return block ? BigInt(block.timestamp) : BigInt(Math.floor(Date.now() / 1000));
}

describe("EncryptedHighLowSepolia", function () {
  let signers: Signers;
  let contract: EncryptedHighLow;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const EncryptedHighLowDeployment = await deployments.get("EncryptedHighLow");
      contractAddress = EncryptedHighLowDeployment.address;
      contract = await ethers.getContractAt("EncryptedHighLow", EncryptedHighLowDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { creator: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create a game and allow player to join", async function () {
    steps = 15;
    this.timeout(4 * 60000); // 4 minutes timeout for Sepolia

    progress("Initializing FHEVM CLI API...");
    await fhevm.initializeCLIApi();

    progress("Encrypting secret number '7'...");
    const secretNumber = 7;
    const salt = "sepolia-test-salt";
    const secretNumberHash = generateHash(secretNumber, salt);
    const encryptedSecret = await fhevm
      .createEncryptedInput(contractAddress, signers.creator.address)
      .add8(secretNumber)
      .encrypt();

    progress(`Creating game on contract ${contractAddress}...`);
    const now = await getCurrentBlockTime();
    const endTime = now + 60n + 3600n; // MIN_DURATION + 1 hour
    const rewardPool = ONE_ETHER / 10n;

    const createTx = await contract
      .connect(signers.creator)
      .createGame(
        encryptedSecret.handles[0],
        encryptedSecret.inputProof,
        secretNumberHash,
        MIN_STAKE,
        endTime,
        rewardPool,
        false,
        { value: rewardPool },
      );
    await createTx.wait();
    progress(`Game created, tx: ${createTx.hash}`);

    progress("Verifying encrypted secret can be decrypted...");
    const handle = await contract.getEncryptedSecret(0);
    const clear = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      handle,
      contractAddress,
      signers.creator,
    );
    progress(`Decrypted secret: ${clear}`);
    expect(clear).to.equal(secretNumber);

    progress("Encrypting player guess (big=true)...");
    const encAlice = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addBool(true)
      .encrypt();

    progress(`Player joining game with stake ${MIN_STAKE}...`);
    const joinTx = await contract
      .connect(signers.alice)
      .joinGame(0, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });
    await joinTx.wait();
    progress(`Player joined, tx: ${joinTx.hash}`);

    progress("Verifying game state...");
    const game = await contract.getGame(0);
    expect(game.creator).to.eq(signers.creator.address);
    expect(game.totalPot).to.eq(rewardPool + MIN_STAKE);
    expect(game.settled).to.eq(false);

    progress("Verifying participant info...");
    const participant = await contract.getParticipant(0, signers.alice.address);
    expect(participant.exists).to.eq(true);
    expect(participant.stake).to.eq(MIN_STAKE);

    progress("Test completed successfully!");
  });

  it("should verify contract constants", async function () {
    steps = 3;
    this.timeout(30000);

    progress("Checking MIN_STAKE constant...");
    const minStake = await contract.MIN_STAKE();
    expect(minStake).to.eq(MIN_STAKE);
    progress(`MIN_STAKE: ${minStake}`);

    progress("Checking MIN_DURATION constant...");
    const minDuration = await contract.MIN_DURATION();
    expect(minDuration).to.eq(60n);
    progress(`MIN_DURATION: ${minDuration}`);

    progress("Checking MIN_CREATOR_REWARD constant...");
    const minCreatorReward = await contract.MIN_CREATOR_REWARD();
    expect(minCreatorReward).to.eq(1n);
    progress(`MIN_CREATOR_REWARD: ${minCreatorReward}`);

    progress("Constants verification completed!");
  });

  it("should handle view functions correctly", async function () {
    steps = 5;
    this.timeout(30000);

    progress("Checking totalGames()...");
    const totalGames = await contract.totalGames();
    progress(`Total games: ${totalGames}`);

    progress("Checking listParticipants for game 0...");
    try {
      const participants = await contract.listParticipants(0);
      progress(`Participants count: ${participants.length}`);
    } catch (e) {
      progress(`Game 0 may not exist: ${(e as Error).message}`);
    }

    progress("View functions test completed!");
  });
});

