import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

const ONE_ETHER = ethers.parseEther("1");
const MIN_STAKE = 1_000_000_000_000_000n; // 0.001 ether

describe("EncryptedHighLow", () => {
  before(function () {
    if (!fhevm.isMock) {
      // Tests rely on the local mock coprocessor for deterministic encryption/decryption.
      this.skip();
    }
  });

  it("stores the encrypted secret and allows decryption through fhevm helper", async () => {
    const [creator] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EncryptedHighLow");
    const contract = await factory.deploy();

    await fhevm.initializeCLIApi();
    const encryptedSecret = await fhevm.createEncryptedInput(contract.target as string, creator.address).add8(7).encrypt();

    const now = Math.floor(Date.now() / 1000);
    await contract
      .connect(creator)
      .createGame(encryptedSecret.handles[0], encryptedSecret.inputProof, MIN_STAKE, BigInt(now + 3600), ONE_ETHER / 10n, {
        value: ONE_ETHER / 10n,
      });

    const handle = await contract.getEncryptedSecret(0);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint8, handle, contract.target as string, creator);
    expect(clear).to.equal(7);
  });

  it("runs a full round lifecycle with encrypted guesses and payouts", async () => {
    const [creator, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EncryptedHighLow");
    const contract = await factory.deploy();

    await fhevm.initializeCLIApi();
    const secret = await fhevm.createEncryptedInput(contract.target as string, creator.address).add8(8).encrypt();
    const endTime = BigInt(Math.floor(Date.now() / 1000) + 3600);

    await contract
      .connect(creator)
      .createGame(secret.handles[0], secret.inputProof, MIN_STAKE, endTime, ONE_ETHER / 10n, {
        value: ONE_ETHER / 10n,
      });

    const encAlice = await fhevm.createEncryptedInput(contract.target as string, alice.address).addBool(true).encrypt();
    await contract.connect(alice).joinGame(0, encAlice.handles[0], encAlice.inputProof, { value: MIN_STAKE });

    const encBob = await fhevm.createEncryptedInput(contract.target as string, bob.address).addBool(false).encrypt();
    await contract.connect(bob).joinGame(0, encBob.handles[0], encBob.inputProof, { value: MIN_STAKE });

    // Fast forward beyond end time
    await ethers.provider.send("evm_increaseTime", [4000]);
    await ethers.provider.send("evm_mine", []);

    const guesses = [true, false];
    await expect(contract.connect(creator).debugReveal(0, 8, guesses)).to.emit(contract, "GameSettled");

    const summary = await contract.getGame(0);
    expect(summary.settled).to.eq(true);
    
    await expect(contract.connect(bob).claimWinnings(0)).to.be.revertedWith("EncryptedHighLow: not eligible");

    await expect(contract.connect(creator).claimCreator(0)).to.emit(contract, "CreatorClaimed");
    const updatedGame = await contract.getGame(0);
    expect(updatedGame.creatorClaimed).to.eq(true);
  });
});

