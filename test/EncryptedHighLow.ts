import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedHighLow, EncryptedHighLow__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  creator: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

const ONE_ETHER = ethers.parseEther("1");
const MIN_STAKE = ethers.parseEther("0.001");
const MIN_DURATION = 60n;

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedHighLow")) as EncryptedHighLow__factory;
  const contract = (await factory.deploy()) as EncryptedHighLow;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

function generateHash(secretNumber: number, salt: string | Uint8Array): string {
  // Convert salt to bytes32
  let saltBytes: Uint8Array;
  if (typeof salt === "string") {
    // Check if it's a hex string (starts with 0x)
    if (salt.startsWith("0x")) {
      // It's already a hex string, convert to bytes
      saltBytes = ethers.getBytes(salt);
      // Ensure it's exactly 32 bytes
      if (saltBytes.length !== 32) {
        const padded = new Uint8Array(32);
        padded.set(saltBytes.slice(0, 32));
        saltBytes = padded;
      }
    } else {
      // It's a regular string, convert to UTF-8 bytes
      const saltHex = ethers.toUtf8Bytes(salt);
      const padded = new Uint8Array(32);
      padded.set(saltHex.slice(0, 32));
      saltBytes = padded;
    }
  } else {
    saltBytes = salt;
    // Ensure it's exactly 32 bytes
    if (saltBytes.length !== 32) {
      const padded = new Uint8Array(32);
      padded.set(saltBytes.slice(0, 32));
      saltBytes = padded;
    }
  }
  return ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32"], [secretNumber, saltBytes]));
}

function stringToBytes32(str: string): string {
  // Convert string to bytes32 (pad or truncate to 32 bytes)
  const bytes = ethers.toUtf8Bytes(str);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return ethers.hexlify(padded);
}

async function getCurrentBlockTime(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return block ? BigInt(block.timestamp) : BigInt(Math.floor(Date.now() / 1000));
}

describe("EncryptedHighLow", function () {
  let signers: Signers;
  let contract: EncryptedHighLow;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      creator: ethSigners[1],
      alice: ethSigners[2],
      bob: ethSigners[3],
      charlie: ethSigners[4],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
    await fhevm.initializeCLIApi();
  });

  describe("Constants", function () {
    it("should have correct MIN_STAKE", async function () {
      expect(await contract.MIN_STAKE()).to.eq(MIN_STAKE);
    });

    it("should have correct MIN_DURATION", async function () {
      expect(await contract.MIN_DURATION()).to.eq(MIN_DURATION);
    });

    it("should have correct MIN_CREATOR_REWARD", async function () {
      expect(await contract.MIN_CREATOR_REWARD()).to.eq(1n);
    });
  });

  describe("Game Creation", function () {
    it("should create a game with encrypted secret", async function () {
      const secretNumber = 7;
      const salt = "test-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await expect(
        contract
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
          ),
      )
        .to.emit(contract, "GameCreated")
        .withArgs(0, signers.creator.address, MIN_STAKE, endTime, rewardPool);

      const handle = await contract.getEncryptedSecret(0);
      const clear = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        handle,
        contractAddress,
        signers.creator,
      );
      expect(clear).to.equal(secretNumber);
    });

    it("should reject game creation with end time too soon", async function () {
      const secretNumber = 5;
      const salt = "test-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + 30n; // Less than MIN_DURATION

      await expect(
        contract
          .connect(signers.creator)
          .createGame(
            encryptedSecret.handles[0],
            encryptedSecret.inputProof,
            secretNumberHash,
            MIN_STAKE,
            endTime,
            ONE_ETHER / 10n,
            false,
            { value: ONE_ETHER / 10n },
          ),
      ).to.be.revertedWith("EncryptedHighLow: end time too soon");
    });

    it("should reject game creation with min stake too low", async function () {
      const secretNumber = 5;
      const salt = "test-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const lowStake = MIN_STAKE - 1n;

      await expect(
        contract
          .connect(signers.creator)
          .createGame(
            encryptedSecret.handles[0],
            encryptedSecret.inputProof,
            secretNumberHash,
            lowStake,
            endTime,
            ONE_ETHER / 10n,
            false,
            { value: ONE_ETHER / 10n },
          ),
      ).to.be.revertedWith("EncryptedHighLow: min stake too low");
    });

    it("should reject game creation with reward funding mismatch", async function () {
      const secretNumber = 5;
      const salt = "test-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await expect(
        contract
          .connect(signers.creator)
          .createGame(
            encryptedSecret.handles[0],
            encryptedSecret.inputProof,
            secretNumberHash,
            MIN_STAKE,
            endTime,
            rewardPool,
            false,
            { value: rewardPool - 1n }, // Wrong amount
          ),
      ).to.be.revertedWith("EncryptedHighLow: reward funding mismatch");
    });

    it("should create game with auto-settle enabled", async function () {
      const secretNumber = 8;
      const salt = "auto-settle-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
        .connect(signers.creator)
        .createGame(
          encryptedSecret.handles[0],
          encryptedSecret.inputProof,
          secretNumberHash,
          MIN_STAKE,
          endTime,
          rewardPool,
          true, // enableAutoSettle
          { value: rewardPool },
        );

      const game = await contract.getGame(0);
      expect(game.autoSettleEnabled).to.eq(true);
    });
  });

  describe("Joining Games", function () {
    let gameId: bigint;
    let secretNumber: number;
    let secretNumberHash: string;
    let endTime: bigint;

    beforeEach(async function () {
      secretNumber = 8;
      const salt = "join-test-salt";
      secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      const tx = await contract
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
      const receipt = await tx.wait();
      gameId = 0n;
    });

    it("should allow players to join with encrypted guess", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();

      await expect(
        contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
          value: MIN_STAKE,
        }),
      )
        .to.emit(contract, "GameJoined")
        .withArgs(gameId, signers.alice.address, MIN_STAKE);

      const participant = await contract.getParticipant(gameId, signers.alice.address);
      expect(participant.exists).to.eq(true);
      expect(participant.stake).to.eq(MIN_STAKE);
    });

    it("should reject join with insufficient stake", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();

      await expect(
        contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
          value: MIN_STAKE - 1n,
        }),
      ).to.be.revertedWith("EncryptedHighLow: insufficient stake");
    });

    it("should reject creator joining their own game", async function () {
      const encCreator = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .addBool(true)
        .encrypt();

      await expect(
        contract
          .connect(signers.creator)
          .joinGame(gameId, encCreator.handles[0], encCreator.inputProof, {
            value: MIN_STAKE,
          }),
      ).to.be.revertedWith("EncryptedHighLow: creator cannot join");
    });

    it("should reject duplicate join", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();

      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      await expect(
        contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
          value: MIN_STAKE,
        }),
      ).to.be.revertedWith("EncryptedHighLow: already joined");
    });

    it("should reject join after end time", async function () {
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();

      await expect(
        contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
          value: MIN_STAKE,
        }),
      ).to.be.revertedWith("EncryptedHighLow: match already closed");
    });

    it("should allow multiple players to join", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      const encBob = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .addBool(false)
        .encrypt();
      await contract.connect(signers.bob).joinGame(gameId, encBob.handles[0], encBob.inputProof, {
        value: MIN_STAKE,
      });

      const participants = await contract.listParticipants(gameId);
      expect(participants.length).to.eq(2);
      expect(participants[0]).to.eq(signers.alice.address);
      expect(participants[1]).to.eq(signers.bob.address);
    });
  });

  describe("Game Settlement", function () {
    let gameId: bigint;
    let secretNumber: number;
    let secretNumberHash: string;
    let salt: string;

    beforeEach(async function () {
      secretNumber = 8;
      salt = "settle-test-salt";
      secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      gameId = 0n;
    });

    it("should run full round lifecycle with encrypted guesses and payouts", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      const encBob = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .addBool(false)
        .encrypt();
      await contract.connect(signers.bob).joinGame(gameId, encBob.handles[0], encBob.inputProof, {
        value: MIN_STAKE,
      });

      // Fast forward beyond end time
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      const guesses = [true, false];
      await expect(contract.connect(signers.creator).debugReveal(gameId, secretNumber, guesses))
        .to.emit(contract, "GameSettled");

      const summary = await contract.getGame(gameId);
      expect(summary.settled).to.eq(true);
      expect(summary.revealedNumber).to.eq(secretNumber);
      expect(summary.numberIsBig).to.eq(true);
      expect(summary.winnersCount).to.eq(1n);

      // Bob guessed wrong (small), Alice guessed right (big)
      await expect(contract.connect(signers.bob).claimWinnings(gameId)).to.be.revertedWith(
        "EncryptedHighLow: not eligible",
      );

      const claimTx = await contract.connect(signers.alice).claimWinnings(gameId);
      await expect(claimTx).to.emit(contract, "WinningsClaimed");

      const participantAfter = await contract.getParticipant(gameId, signers.alice.address);
      expect(participantAfter.claimed).to.eq(true);
      expect(participantAfter.won).to.eq(true);

      const creatorClaimTx = await contract.connect(signers.creator).claimCreator(gameId);
      await expect(creatorClaimTx).to.emit(contract, "CreatorClaimed");

      const updatedGame = await contract.getGame(gameId);
      expect(updatedGame.creatorClaimed).to.eq(true);
    });

    it("should handle game with no participants", async function () {
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await expect(contract.connect(signers.creator).debugReveal(gameId, secretNumber, []))
        .to.emit(contract, "GameSettled");

      const summary = await contract.getGame(gameId);
      expect(summary.settled).to.eq(true);
      expect(summary.winnersCount).to.eq(0n);
      expect(summary.payoutPerWinner).to.eq(0n);

      // Creator should get all the pot
      await expect(contract.connect(signers.creator).claimCreator(gameId))
        .to.emit(contract, "CreatorClaimed")
        .withArgs(gameId, signers.creator.address, summary.totalPot);
    });

    it("should handle game with no winners", async function () {
      // Secret is 8 (big), both players guess small
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(false)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      const encBob = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .addBool(false)
        .encrypt();
      await contract.connect(signers.bob).joinGame(gameId, encBob.handles[0], encBob.inputProof, {
        value: MIN_STAKE,
      });

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      const guesses = [false, false];
      await contract.connect(signers.creator).debugReveal(gameId, secretNumber, guesses);

      const summary = await contract.getGame(gameId);
      expect(summary.winnersCount).to.eq(0n);
      expect(summary.payoutPerWinner).to.eq(0n);

      // Creator should get all the pot
      await expect(contract.connect(signers.creator).claimCreator(gameId))
        .to.emit(contract, "CreatorClaimed")
        .withArgs(gameId, signers.creator.address, summary.totalPot);
    });

    it("should handle game with multiple winners", async function () {
      // Secret is 8 (big), all players guess big
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      const encBob = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.bob).joinGame(gameId, encBob.handles[0], encBob.inputProof, {
        value: MIN_STAKE,
      });

      const encCharlie = await fhevm
        .createEncryptedInput(contractAddress, signers.charlie.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.charlie).joinGame(gameId, encCharlie.handles[0], encCharlie.inputProof, {
        value: MIN_STAKE,
      });

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      const guesses = [true, true, true];
      await contract.connect(signers.creator).debugReveal(gameId, secretNumber, guesses);

      const summary = await contract.getGame(gameId);
      expect(summary.winnersCount).to.eq(3n);
      expect(summary.payoutPerWinner).to.be.gt(0n);

      // All three should be able to claim
      await expect(contract.connect(signers.alice).claimWinnings(gameId))
        .to.emit(contract, "WinningsClaimed")
        .withArgs(gameId, signers.alice.address, summary.payoutPerWinner);

      await expect(contract.connect(signers.bob).claimWinnings(gameId))
        .to.emit(contract, "WinningsClaimed")
        .withArgs(gameId, signers.bob.address, summary.payoutPerWinner);

      await expect(contract.connect(signers.charlie).claimWinnings(gameId))
        .to.emit(contract, "WinningsClaimed")
        .withArgs(gameId, signers.charlie.address, summary.payoutPerWinner);
    });

    it("should reject debugReveal before end time", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      await expect(
        contract.connect(signers.creator).debugReveal(gameId, secretNumber, [true]),
      ).to.be.revertedWith("EncryptedHighLow: round active");
    });

    it("should reject debugReveal with wrong guess count", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        contract.connect(signers.creator).debugReveal(gameId, secretNumber, [true, false]), // Wrong count
      ).to.be.revertedWith("EncryptedHighLow: mismatch guesses");
    });
  });

  describe("Fair Reveal", function () {
    let gameId: bigint;
    let secretNumber: number;
    let salt: string; // bytes32 as hex string
    let secretNumberHash: string;

    beforeEach(async function () {
      secretNumber = 5;
      salt = stringToBytes32("fair-reveal-salt");
      secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      gameId = 0n;
    });

    it("should allow fair reveal with correct hash", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(false)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        contract.connect(signers.creator).fairReveal(gameId, secretNumber, salt),
      ).to.emit(contract, "GameSettled");
    });

    it("should reject fair reveal with wrong hash", async function () {
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      const wrongSalt = stringToBytes32("wrong-salt");
      await expect(
        contract.connect(signers.creator).fairReveal(gameId, secretNumber, wrongSalt),
      ).to.be.revertedWith("EncryptedHighLow: hash mismatch");
    });

    it("should reject fair reveal by non-creator", async function () {
      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await expect(contract.connect(signers.alice).fairReveal(gameId, secretNumber, salt)).to.be.revertedWith(
        "EncryptedHighLow: only creator can reveal",
      );
    });
  });

  describe("View Functions", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const secretNumber = 7;
      const salt = "view-test-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      gameId = 0n;
    });

    it("should return correct game summary", async function () {
      const game = await contract.getGame(gameId);
      expect(game.creator).to.eq(signers.creator.address);
      expect(game.minStake).to.eq(MIN_STAKE);
      expect(game.rewardPool).to.eq(ONE_ETHER / 10n);
      expect(game.settled).to.eq(false);
      expect(game.autoSettleEnabled).to.eq(false);
    });

    it("should return correct participant info", async function () {
      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(true)
        .encrypt();
      await contract.connect(signers.alice).joinGame(gameId, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      const participant = await contract.getParticipant(gameId, signers.alice.address);
      expect(participant.exists).to.eq(true);
      expect(participant.stake).to.eq(MIN_STAKE);
      expect(participant.won).to.eq(false);
      expect(participant.claimed).to.eq(false);
    });

    it("should return empty participant for non-participant", async function () {
      const participant = await contract.getParticipant(gameId, signers.alice.address);
      expect(participant.exists).to.eq(false);
    });

    it("should return correct total games count", async function () {
      expect(await contract.totalGames()).to.eq(1n);

      // Create another game
      const secretNumber = 3;
      const salt = "second-game-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      expect(await contract.totalGames()).to.eq(2n);
    });

    it("should reject getGame for non-existent game", async function () {
      await expect(contract.getGame(999)).to.be.revertedWith("EncryptedHighLow: game not found");
    });
  });

  describe("Edge Cases", function () {
    it("should handle small secret number (1-5)", async function () {
      const secretNumber = 3;
      const salt = "small-number-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      const encAlice = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .addBool(false) // Guess small
        .encrypt();
      await contract.connect(signers.alice).joinGame(0, encAlice.handles[0], encAlice.inputProof, {
        value: MIN_STAKE,
      });

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await contract.connect(signers.creator).debugReveal(0, secretNumber, [false]);

      const summary = await contract.getGame(0);
      expect(summary.numberIsBig).to.eq(false);
      expect(summary.winnersCount).to.eq(1n);
    });

    it("should handle boundary number 5 (small)", async function () {
      const secretNumber = 5;
      const salt = "boundary-5-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await contract.connect(signers.creator).debugReveal(0, secretNumber, []);

      const summary = await contract.getGame(0);
      expect(summary.numberIsBig).to.eq(false); // 5 is small (1-5)
    });

    it("should handle boundary number 6 (big)", async function () {
      const secretNumber = 6;
      const salt = "boundary-6-salt";
      const secretNumberHash = generateHash(secretNumber, salt);
      const encryptedSecret = await fhevm
        .createEncryptedInput(contractAddress, signers.creator.address)
        .add8(secretNumber)
        .encrypt();

      const now = await getCurrentBlockTime();
      const endTime = now + MIN_DURATION + 3600n;
      const rewardPool = ONE_ETHER / 10n;

      await contract
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

      await ethers.provider.send("evm_increaseTime", [4000]);
      await ethers.provider.send("evm_mine", []);

      await contract.connect(signers.creator).debugReveal(0, secretNumber, []);

      const summary = await contract.getGame(0);
      expect(summary.numberIsBig).to.eq(true); // 6 is big (6-10)
    });
  });
});

