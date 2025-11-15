# Cipher High-Low

Cipher High-Low is an end-to-end MVP demonstrating how to build a fully homomorphic encrypted wagering game with Zama's FHEVM. Game creators publish hi/lo matches by locking an encrypted secret number between 1-10, funding a reward pool, and setting a countdown timer. Challengers participate by staking ETH and choosing encrypted BIG (6-10) or SMALL (1-5) predictions. When the timer expires, the contract requests decryption from the FHE oracle, computes winners based on the revealed secret number, and automatically distributes payouts. The RainbowKit front-end ensures all user interactions remain on-chain and fully encrypted throughout the entire process.

This project showcases privacy-preserving blockchain gaming where sensitive game data remains encrypted until settlement, providing trustless and verifiable outcomes.

## 🎥 Demo Video

[![Cipher High-Low Demo](https://img.shields.io/badge/Video-Demo-red?style=flat&logo=youtube)](./poker-cipher-highlow.mp4)

Watch the full demonstration video showing the encrypted poker game in action. The video demonstrates:
- Creating encrypted games with secret numbers
- Players joining with encrypted BIG/SMALL bets
- Automatic decryption and winner determination
- Secure payout distribution

**Video file**: `poker-cipher-highlow.mp4` (1.0 MB)

## 🌐 Live Demo

[![Vercel Deployment](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=flat&logo=vercel)](https://cipher-high-low.vercel.app/)

Try the live application deployed on Vercel to experience the fully homomorphic encrypted wagering game.

## Project Layout

```
project/poker-cipher-highlow/
├── contracts/           # Solidity sources (EncryptedHighLow.sol)
├── deploy/              # hardhat-deploy scripts
├── tasks/               # Hardhat CLI helpers for local testing
├── test/                # Hardhat tests (uses local FHE mock)
├── ui/                  # Vite + React RainbowKit front-end
└── README.md
```

## Prerequisites

- Node.js 20+
- npm
- Docker (optional if you want to run the FHE relayer stack)
- Rainbow Wallet browser extension or RainbowKit-compatible wallet

## Install Dependencies

From the project root:

```bash
npm install
```

Then install front-end packages:

```bash
cd ui
npm install
```

## Compile & Test Contracts

Compile the contract (FHEVM precompiles are pulled in automatically):

```bash
npm run compile
```

Run the local Hardhat tests (requires FHE mock, automatically used when `hardhat` network is running):

```bash
npm test
```

The test suite deploys `EncryptedHighLow`, performs encrypted joins, calls the debug reveal helper, and asserts payout shares.

## Local Deployment

Start a Hardhat node in one terminal:

```bash
npx hardhat node
```

In another terminal, deploy the contract to the local chain:

```bash
npx hardhat --network localhost deploy
```

Record the deployed contract address from the output and update `ui/src/config/contracts.ts` so the `31337` entry points to the new address.

## Front-End

Configure WalletConnect (RainbowKit requires a project id):

```bash
# ui/.env.local
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

Start the Vite dev server:

```bash
cd ui
npm run dev
```

Connect a Rainbow-compatible wallet in the top-right corner. You can now:

1. **Create a match** – choose a secret number (1–10), minimum stake, reward pool, and countdown.
2. **Join a match** – stake ETH and pick BIG (6–10) or SMALL (1–5). Choices are encrypted client-side via the FHE WASM runtime.
3. **Request reveal** – once the timer expires, trigger decryption to expose the secret number and challenger stances.
4. **Claim rewards** – the creator collects 50% of the pot. Winners share the remaining 50% proportionally.

All reads and writes originate from the contract; the UI does not hold authoritative state.

## Hardhat Tasks

Useful helpers are provided under `tasks/EncryptedHighLow.ts`:

```bash
# Print deployment address
npx hardhat --network localhost hl:address

# Create a match
npx hardhat --network localhost hl:create-game --number 8 --minstake 1000000000000000 --duration 900 --reward 50000000000000000

# Join a match as BIG with 0.002 ETH
npx hardhat --network localhost hl:join-game --id 0 --big true --amount 2000000000000000

# Trigger reveal
npx hardhat --network localhost hl:request-reveal --id 0
```

Tasks rely on the Hardhat FHE CLI mock, so they work seamlessly on `localhost`.

## Debug Reveal (Local Only)

For automated tests and local debugging, `EncryptedHighLow.debugReveal` bypasses the oracle when running on chain id `31337/1337`. This helper is gated and reverts on public networks.

## Custom Branding

- Browser favicon and in-app logo were replaced with the `sentinel` assets under `ui/public` and `ui/src/assets`.
- Copy throughout the UI reflects the encrypted hi/lo business process and omits non-essential components.

## 🔐 Smart Contract Architecture

### Core Data Structures

The contract uses encrypted data types from Zama's FHEVM:

```solidity
struct Game {
    address creator;
    uint256 minStake;
    uint256 endTime;
    euint8 secretNumber;        // Encrypted secret number (1-10)
    bytes32 secretNumberHash;   // Hash commitment for fair reveal
    bool revealPending;
    bool settled;
    address[] participantList;
    mapping(address => Participant) participants;
}

struct Participant {
    ebool choice;              // Encrypted BIG/SMALL choice
    uint256 stake;             // ETH staked
    bool exists;
    bool won;
    bool claimed;
    bool choiceRevealed;
    bool guessedBig;           // Decrypted choice result
}
```

### 🔑 Key Encryption/Decryption Logic

#### 1. Game Creation with Encrypted Secret
```solidity
function createGame(
    externalEuint8 secretNumberHandle,  // Encrypted secret from client
    bytes calldata inputProof,          // ZKP proof from FHE relayer
    bytes32 secretNumberHash,           // Hash commitment: keccak256(abi.encodePacked(secretNumber, salt))
    // ... other params
) external payable returns (uint256 gameId) {
    // Store encrypted secret
    g.secretNumber = FHE.fromExternal(secretNumberHandle, inputProof);
    g.secretNumberHash = secretNumberHash;

    // Allow contract and creator to access the encrypted data
    FHE.allowThis(g.secretNumber);
    FHE.allow(g.secretNumber, msg.sender);
}
```

#### 2. Player Join with Encrypted Choice
```solidity
function joinGame(
    uint256 gameId,
    externalEbool guessHandle,    // Encrypted BIG/SMALL choice
    bytes calldata inputProof
) external payable gameExists(gameId) {
    Participant storage p = g.participants[msg.sender];
    p.choice = FHE.fromExternal(guessHandle, inputProof);

    // Allow contract and player to access encrypted choice
    FHE.allowThis(p.choice);
    FHE.allow(p.choice, msg.sender);
}
```

#### 3. Decryption Request Process
```solidity
function requestReveal(uint256 gameId) external gameExists(gameId) {
    // Collect all encrypted handles for batch decryption
    bytes32[] memory handles = new bytes32[](participantCount + 1);
    handles[0] = FHE.toBytes32(g.secretNumber);  // Secret number

    for (uint256 i = 0; i < participantCount; i++) {
        handles[i + 1] = FHE.toBytes32(g.participants[participantList[i]].choice);
    }

    // Request decryption from FHE oracle
    uint256 requestId = FHE.requestDecryption(handles, this.revealCallback.selector);
}
```

#### 4. Decryption Callback and Winner Determination
```solidity
function revealCallback(
    uint256 requestId,
    bytes calldata cleartexts,     // Decrypted plaintext values
    bytes calldata decryptionProof
) external returns (bool) {
    // Verify oracle signature
    FHE.checkSignatures(requestId, cleartexts, decryptionProof);

    // Decode decrypted values
    (uint8 revealedNumber, bool[] memory guesses) = abi.decode(cleartexts, (uint8, bool[]));

    // Determine winners: guess correctly matches if number > 5
    bool isBig = revealedNumber > 5;
    for (uint256 i = 0; i < guesses.length; i++) {
        bool guessedBig = guesses[i];
        bool isWinner = (isBig && guessedBig) || (!isBig && !guessedBig);
        // ... update participant status
    }
}
```

### 🛡️ Security Features

- **Hash Commitments**: Prevents creators from changing secret numbers after game creation
- **Encrypted State**: All sensitive data remains encrypted until game settlement
- **Zero-Knowledge Proofs**: FHE relayer provides cryptographic proofs for encrypted operations
- **Fair Reveal**: Multiple reveal mechanisms (oracle, debug mode, fair reveal) for different environments
- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard

### 💰 Payout Distribution

The contract implements a 50/50 split:
- **Creator**: Receives 50% of total pot + any remainder from uneven division
- **Winners**: Share remaining 50% equally among correct guessers
- **Losers**: Forfeit their stake (goes to creator and winners)

## Next Steps

- Hook up a live FHE relayer / decryption oracle for non-local reveals.
- Deploy to Sepolia and update `ui/src/config/contracts.ts` with the deployed address.
- Implement on-chain event indexing for historical analytics.
