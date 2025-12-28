# Encrypted High-Low Game

A fully homomorphic encryption (FHE) based high-low prediction game built on Ethereum using Zama's FHEVM. Players can place encrypted bets on whether a secret number (1-10) will be "big" (6-10) or "small" (1-5), with all game logic executed on-chain while maintaining complete privacy.

## 🌐 Live Demo

**Vercel Deployment:** [https://cipher-high-low.vercel.app/](https://cipher-high-low.vercel.app/)

## 📹 Demo Video

**[Watch Demo Video](https://youtu.be/ppB8LbanjTw)** - See the game in action!

## Features

- **Fully Encrypted Gameplay**: All player choices and secret numbers are encrypted using FHE, ensuring privacy until reveal
- **Fair Commit-Reveal Scheme**: Creators commit to secret numbers with cryptographic hashes for provable fairness
- **Automatic Settlement**: Optional auto-settlement feature for games that end without manual reveal
- **On-Chain Verification**: All game logic and payout calculations are executed on-chain with transparent verification
- **Modern React Frontend**: Beautiful, responsive UI built with React, Tailwind CSS, and RainbowKit
- **Comprehensive Testing**: Full test suite covering game lifecycle, edge cases, and error scenarios

## Architecture

### Smart Contract (`EncryptedHighLow.sol`)

The core game logic is implemented as a Solidity smart contract that leverages Zama's FHEVM for encrypted computations:

- **Game Creation**: Creators deposit a reward pool and set encrypted secret numbers
- **Player Participation**: Players join games with encrypted guesses (big/small) and stakes
- **Reveal Mechanism**: Two reveal methods:
  - **Fair Reveal**: Commit-reveal pattern with cryptographic hashes
  - **Auto Settle**: Automatic settlement when game end time is reached
- **Payout Distribution**: Winners receive 50% of the pot, creator receives 50% plus any rounding remainder

### Core Contract Code Explanation

The contract implements a privacy-preserving high-low game using Fully Homomorphic Encryption (FHE). Here are the key components:

#### 1. **Encrypted Data Structures**

```solidity
struct Game {
    address creator;
    euint8 secretNumber;              // Encrypted secret number (1-10)
    bytes32 secretNumberHash;         // Hash commitment for fair reveal
    mapping(address => Participant) participants;
    // ... other fields
}

struct Participant {
    ebool choice;                     // Encrypted guess (true=big, false=small)
    uint256 stake;
    bool won;
    bool claimed;
}
```

**Key Points:**
- `euint8 secretNumber`: The secret number is stored as an encrypted uint8, ensuring privacy until reveal
- `ebool choice`: Player guesses are encrypted booleans, preventing front-running
- `bytes32 secretNumberHash`: Cryptographic commitment for fair reveal verification

#### 2. **Game Creation with FHE Encryption**

```solidity
function createGame(
    externalEuint8 secretNumberHandle,
    bytes calldata inputProof,
    bytes32 secretNumberHash,
    uint256 minStake,
    uint256 endTime,
    uint256 rewardPool,
    bool enableAutoSettle
) external payable returns (uint256 gameId)
```

**How it works:**
- Creator encrypts secret number (1-10) client-side using FHEVM SDK
- Submits encrypted handle with cryptographic proof
- Stores hash commitment for later verification
- Sets up game parameters (min stake, end time, reward pool)
- Grants ACL permissions for decryption access

**Security:**
- `FHE.fromExternal()` validates the encrypted input with proof
- `FHE.allow()` grants decryption permissions only to authorized parties
- Hash commitment prevents creator from changing the number after players join

#### 3. **Player Participation with Encrypted Guesses**

```solidity
function joinGame(
    uint256 gameId,
    externalEbool guessHandle,
    bytes calldata inputProof
) external payable
```

**How it works:**
- Player encrypts their guess (big/small) client-side
- Submits encrypted boolean with stake amount
- Contract stores encrypted choice without revealing it
- Total pot increases with each participant

**Privacy Guarantee:**
- Player choices remain encrypted on-chain
- No one can see guesses until decryption
- Prevents front-running and strategic manipulation

#### 4. **FHE Decryption Request**

```solidity
function requestReveal(uint256 gameId) external {
    // Collect all encrypted handles
    bytes32[] memory handles = new bytes32[](participantCount + 1);
    handles[0] = FHE.toBytes32(g.secretNumber);
    
    for (uint256 i = 0; i < participantCount; i++) {
        handles[i + 1] = FHE.toBytes32(p.choice);
    }
    
    // Request asynchronous decryption from FHEVM oracle
    uint256 requestId = FHE.requestDecryption(handles, this.revealCallback.selector);
}
```

**How it works:**
- After game end time, anyone can trigger reveal
- Collects all encrypted handles (secret number + player choices)
- Requests decryption from FHEVM oracle
- Oracle asynchronously decrypts and calls `revealCallback()`

#### 5. **Settlement Logic**

```solidity
function revealCallback(
    uint256 requestId,
    bytes calldata cleartexts,
    bytes calldata decryptionProof
) external returns (bool) {
    // Verify decryption proof
    FHE.checkSignatures(requestId, cleartexts, decryptionProof);
    
    // Decode revealed values
    (uint8 revealedNumber, bool[] memory guesses) = 
        abi.decode(cleartexts, (uint8, bool[]));
    
    // Complete settlement
    _completeSettlement(g, revealedNumber, guesses);
}
```

**Settlement Algorithm:**
1. **Determine Winners**: Compare revealed number with player guesses
   - If number > 5 (big) and player guessed big → winner
   - If number ≤ 5 (small) and player guessed small → winner

2. **Calculate Payouts**:
   ```solidity
   uint256 creatorShare = totalPot / 2;        // 50% to creator
   uint256 winnersShare = totalPot - creatorShare;  // 50% to winners
   uint256 perWinner = winnersShare / winnersCount;  // Split among winners
   uint256 remainder = totalPot - creatorShare - (perWinner * winnersCount);
   // Remainder goes to creator
   ```

3. **Auto-Distribution** (if enabled):
   - Automatically transfers rewards to creator and winners
   - No manual claiming required

#### 6. **Fair Reveal Mechanism**

```solidity
function fairReveal(
    uint256 gameId,
    uint8 originalSecretNumber,
    bytes32 salt
) external returns (bool) {
    // Verify hash commitment
    bytes32 computedHash = keccak256(abi.encodePacked(originalSecretNumber, salt));
    require(computedHash == g.secretNumberHash, "Hash mismatch");
    
    // Complete settlement with verified number
    _completeSettlement(g, originalSecretNumber, guesses);
}
```

**Fairness Guarantee:**
- Creator commits to secret number hash before players join
- Cannot change number after seeing player bets
- Hash verification ensures commitment integrity
- Recommended for production use

#### 7. **Security Features**

- **Reentrancy Protection**: All state-changing functions use `ReentrancyGuard`
- **Input Validation**: Comprehensive checks on all parameters
- **Access Control**: Only creator can reveal, only participants can claim
- **FHE Security**: Leverages Zama's battle-tested FHEVM implementation
- **Safe Transfers**: Uses low-level call with error checking

**Key Security Patterns:**
```solidity
modifier gameExists(uint256 gameId) {
    require(gameId < nextGameId, "Game not found");
    _;
}

function claimWinnings(uint256 gameId) external nonReentrant {
    // CEI pattern: Checks, Effects, Interactions
    require(g.settled, "Not settled");
    require(p.won && !p.claimed, "Not eligible");
    p.claimed = true;  // Effect before interaction
    _safeTransfer(msg.sender, g.payoutPerWinner);
}
```

### Frontend (`ui/`)

The React frontend provides a complete user interface for interacting with the game:

- **Wallet Integration**: RainbowKit for seamless wallet connection
- **FHE Encryption**: Client-side encryption of player choices before submission
- **Real-time Updates**: Automatic polling and event listeners for game state updates
- **Responsive Design**: Mobile-friendly interface with modern UI components

## Technology Stack

- **Blockchain**: Ethereum (Sepolia testnet, local Hardhat network)
- **FHE Framework**: Zama FHEVM
- **Smart Contracts**: Solidity 0.8.20+
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Wallet**: RainbowKit, Wagmi, Viem
- **Testing**: Hardhat, Chai, Ethers.js

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Hardhat development environment
- MetaMask or compatible Ethereum wallet
- Access to Sepolia testnet (for testnet deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Lilith416/poker-cipher-play.git
cd poker-cipher-play
```

2. Install dependencies:
```bash
npm install
cd ui && npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

1. Start local Hardhat node:
```bash
npx hardhat node
```

2. Deploy contracts:
```bash
npx hardhat deploy --network localhost
```

3. Update contract addresses in `ui/src/config/contracts.ts`

4. Start frontend development server:
```bash
cd ui
npm run dev
```

5. Open http://localhost:5173 in your browser

### Testing

Run the test suite:
```bash
npx hardhat test
```

Run tests with coverage:
```bash
npx hardhat coverage
```

## Game Flow

1. **Game Creation**:
   - Creator selects a secret number (1-10)
   - Creator deposits reward pool and sets minimum stake
   - Creator can enable auto-settlement
   - Secret number is encrypted and committed on-chain

2. **Player Participation**:
   - Players browse available games
   - Players choose "big" (6-10) or "small" (1-5)
   - Players stake at least the minimum amount
   - Player choices are encrypted before submission

3. **Reveal Phase**:
   - After game end time, reveal can be requested
   - Creator reveals secret number using commit-reveal scheme
   - FHEVM decrypts all encrypted data
   - Winners are determined and payouts calculated

4. **Settlement**:
   - Winners can claim their share (50% of pot divided among winners)
   - Creator can claim their share (50% plus remainder)
   - All payouts are distributed automatically

## Security Considerations

- **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
- **Input Validation**: Comprehensive validation of all user inputs
- **Access Control**: Proper checks to prevent unauthorized actions
- **FHE Security**: Leverages Zama's battle-tested FHEVM implementation
- **Fair Reveal**: Cryptographic commit-reveal scheme prevents cheating

## Contract Functions

### Public Functions

- `createGame()`: Create a new game with encrypted secret number
- `joinGame()`: Join a game with encrypted guess and stake
- `requestReveal()`: Request decryption of game data
- `fairReveal()`: Reveal secret number using commit-reveal scheme
- `autoSettle()`: Automatically settle game after end time
- `claimWinnings()`: Claim winnings for winning players
- `claimCreator()`: Claim creator share of rewards

### View Functions

- `getGame()`: Get game summary information
- `getParticipant()`: Get participant information for a game
- `listParticipants()`: List all participants in a game
- `totalGames()`: Get total number of games created

## Deployment

### Local Network

```bash
npx hardhat deploy --network localhost
```

### Sepolia Testnet

1. Configure `hardhat.config.ts` with your Sepolia RPC URL
2. Add your private key to `.env`
3. Deploy:
```bash
npx hardhat deploy --network sepolia
```

4. Verify contract:
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Zama for FHEVM and FHE technology
- OpenZeppelin for security patterns
- RainbowKit and Wagmi teams for excellent wallet integration tools

