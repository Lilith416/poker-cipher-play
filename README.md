# Encrypted High-Low Game

A fully homomorphic encryption (FHE) based high-low prediction game built on Ethereum using Zama's FHEVM. Players can place encrypted bets on whether a secret number (1-10) will be "big" (6-10) or "small" (1-5), with all game logic executed on-chain while maintaining complete privacy.

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

## Demo Video

See `poker-cipher-highlow.mp4` for a complete walkthrough of the game functionality.
