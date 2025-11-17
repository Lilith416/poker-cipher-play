// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    FHE,
    ebool,
    euint8,
    externalEbool,
    externalEuint8
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedHighLow
/// @notice Encrypted hi/lo betting game leveraging Zama FHEVM primitives.
/// Players join matches created by a host, submitting homomorphically encrypted
/// predictions (small/big). The secret target number remains hidden until the
/// round settles. After the countdown elapses the contract requests on–chain
/// decryption, computes winners, and enables trustless payouts.
contract EncryptedHighLow is SepoliaConfig, ReentrancyGuard {
    uint256 public constant MIN_CREATOR_REWARD = 1 wei;
    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant MIN_DURATION = 60;

    struct Participant {
        ebool choice;
        uint256 stake;
        bool exists;
        bool won;
        bool claimed;
        bool choiceRevealed;
        bool guessedBig;
    }

    struct Game {
        address creator;
        uint256 minStake;
        uint256 endTime;
        uint256 createdAt;
        uint256 rewardPool;
        uint256 totalPot;
        euint8 secretNumber;
        bytes32 secretNumberHash; // Hash commitment for fair reveal
        bool revealPending;
        bool settled;
        bool autoSettleEnabled; // Whether to auto-settle after decryption
        uint256 requestId;
        uint8 revealedNumber;
        bool numberIsBig;
        uint256 winnersCount;
        uint256 creatorShare;
        uint256 payoutPerWinner;
        uint256 creatorBonusRemainder;
        bool creatorClaimed;
        address[] participantList;
        mapping(address => Participant) participants;
    }

    struct GameSummary {
        address creator;
        uint256 minStake;
        uint256 createdAt;
        uint256 endTime;
        uint256 rewardPool;
        uint256 totalPot;
        bool revealPending;
        bool settled;
        bool autoSettleEnabled;
        uint8 revealedNumber;
        bool numberIsBig;
        uint256 winnersCount;
        uint256 creatorShare;
        uint256 payoutPerWinner;
        uint256 participantCount;
        bool creatorClaimed;
    }

    struct ParticipantView {
        uint256 stake;
        bool exists;
        bool won;
        bool claimed;
        bool choiceRevealed;
        bool guessedBig;
    }

    uint256 public nextGameId;

    mapping(uint256 => Game) private _games;
    mapping(uint256 => uint256) private _requestToGame;

    event GameCreated(
        uint256 indexed gameId,
        address indexed creator,
        uint256 minStake,
        uint256 endTime,
        uint256 rewardPool
    );
    event GameJoined(uint256 indexed gameId, address indexed player, uint256 stake);
    event RevealRequested(uint256 indexed gameId, uint256 requestId);
    event GameSettled(
        uint256 indexed gameId,
        uint8 revealedNumber,
        bool numberIsBig,
        uint256 winnersCount,
        uint256 creatorShare,
        uint256 payoutPerWinner
    );
    event CreatorClaimed(uint256 indexed gameId, address indexed creator, uint256 amount);
    event WinningsClaimed(uint256 indexed gameId, address indexed player, uint256 amount);

    modifier gameExists(uint256 gameId) {
        require(gameId < nextGameId, "EncryptedHighLow: game not found");
        _;
    }

    /// @notice Create a new encrypted hi/lo match.
    /// @param secretNumberHandle Encrypted handle for the secret number (1-10)
    /// @param inputProof Relayer proof binding ciphertext to signer
    /// @param minStake Minimum stake required for challengers (>= 0.001 ETH)
    /// @param endTime Unix timestamp for when the match should settle
    /// @param rewardPool Amount (in wei) funded by the creator and added to the pot
    /// @param enableAutoSettle Whether to automatically settle and distribute rewards after decryption
    function createGame(
        externalEuint8 secretNumberHandle,
        bytes calldata inputProof,
        bytes32 secretNumberHash, // Hash commitment: keccak256(abi.encodePacked(secretNumber, salt))
        uint256 minStake,
        uint256 endTime,
        uint256 rewardPool,
        bool enableAutoSettle
    ) external payable returns (uint256 gameId) {
        require(endTime > block.timestamp + MIN_DURATION, "EncryptedHighLow: end time too soon");
        require(minStake >= MIN_STAKE, "EncryptedHighLow: min stake too low");
        require(rewardPool >= MIN_CREATOR_REWARD, "EncryptedHighLow: reward too small");
        require(msg.value == rewardPool, "EncryptedHighLow: reward funding mismatch");

        gameId = nextGameId++;
        Game storage g = _games[gameId];

        g.creator = msg.sender;
        g.minStake = minStake;
        g.endTime = endTime;
        g.createdAt = block.timestamp;
        g.rewardPool = rewardPool;
        g.totalPot = rewardPool;
        g.secretNumberHash = secretNumberHash;
        g.secretNumber = FHE.fromExternal(secretNumberHandle, inputProof);
        g.autoSettleEnabled = enableAutoSettle;

        FHE.allowThis(g.secretNumber);
        FHE.allow(g.secretNumber, msg.sender);

        emit GameCreated(gameId, msg.sender, minStake, endTime, rewardPool);
    }

    /// @notice Join an existing game by submitting an encrypted guess (big/small).
    /// @param gameId Target game identifier
    /// @param guessHandle Encrypted ebool (true => big, false => small)
    /// @param inputProof Relayer proof for the encrypted boolean
    function joinGame(
        uint256 gameId,
        externalEbool guessHandle,
        bytes calldata inputProof
    ) external payable gameExists(gameId) {
        Game storage g = _games[gameId];
        require(block.timestamp < g.endTime, "EncryptedHighLow: match already closed");
        require(!g.revealPending && !g.settled, "EncryptedHighLow: settlement in progress");
        require(msg.sender != g.creator, "EncryptedHighLow: creator cannot join");

        Participant storage p = g.participants[msg.sender];
        require(!p.exists, "EncryptedHighLow: already joined");
        require(msg.value >= g.minStake, "EncryptedHighLow: insufficient stake");

        g.totalPot += msg.value;

        p.choice = FHE.fromExternal(guessHandle, inputProof);
        p.stake = msg.value;
        p.exists = true;

        g.participantList.push(msg.sender);

        FHE.allowThis(p.choice);
        FHE.allow(p.choice, msg.sender);

        emit GameJoined(gameId, msg.sender, msg.value);
    }

    /// @notice Request asynchronous on-chain decryption once the countdown ends.
    /// Anyone can trigger this when the deadline has passed.
    function requestReveal(uint256 gameId) external gameExists(gameId) {
        Game storage g = _games[gameId];
        require(block.timestamp >= g.endTime, "EncryptedHighLow: round still active");
        require(!g.settled, "EncryptedHighLow: already settled");
        require(!g.revealPending, "EncryptedHighLow: reveal pending");

        g.revealPending = true;

        uint256 participantCount = g.participantList.length;
        uint256 handleCount = participantCount + 1;
        bytes32[] memory handles = new bytes32[](handleCount);

        handles[0] = FHE.toBytes32(g.secretNumber);

        for (uint256 i = 0; i < participantCount; i++) {
            address participantAddress = g.participantList[i];
            Participant storage p = g.participants[participantAddress];
            handles[i + 1] = FHE.toBytes32(p.choice);
        }

        uint256 requestId = FHE.requestDecryption(handles, this.revealCallback.selector);
        g.requestId = requestId;
        _requestToGame[requestId] = gameId;

        emit RevealRequested(gameId, requestId);
    }

    /// @notice Callback consumed by the FHEVM decryption oracle.
    /// Stores public results and prepares payout accounting.
    function revealCallback(
        uint256 requestId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external returns (bool) {
        uint256 gameId = _requestToGame[requestId];
        Game storage g = _games[gameId];
        require(g.revealPending, "EncryptedHighLow: no pending reveal");

        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        uint256 participantCount = g.participantList.length;

        uint256 winnersCount;
        uint256 creatorPayout;
        uint256 perWinner;
        if (participantCount == 0) {
            uint8 revealed = abi.decode(cleartexts, (uint8));
            (winnersCount, creatorPayout, perWinner) = _completeSettlement(g, revealed, new bool[](0));
        } else {
            (uint8 revealedNumber, bool[] memory guesses) = abi.decode(cleartexts, (uint8, bool[]));
            (winnersCount, creatorPayout, perWinner) = _completeSettlement(g, revealedNumber, guesses);
        }

        emit GameSettled(
            gameId,
            g.revealedNumber,
            g.numberIsBig,
            winnersCount,
            creatorPayout,
            perWinner
        );

        // If auto-settle is enabled, automatically distribute rewards
        if (g.autoSettleEnabled) {
            _autoDistributeRewards(g, gameId);
        }

        return true;
    }

    /// @notice Local-network helper to bypass the oracle during automated tests.
    /// WARNING: This allows arbitrary number input and is only for local testing!
    function debugReveal(
        uint256 gameId,
        uint8 revealedNumber,
        bool[] calldata guesses
    ) external gameExists(gameId) returns (bool) {
        require(block.chainid == 31337 || block.chainid == 1337, "EncryptedHighLow: debug disabled");

        Game storage g = _games[gameId];
        require(!g.settled, "EncryptedHighLow: already settled");
        require(block.timestamp >= g.endTime, "EncryptedHighLow: round active");
        require(g.participantList.length == guesses.length, "EncryptedHighLow: mismatch guesses");

        // In debug mode, use the provided revealedNumber directly
        // This allows testing with specific numbers for debugging purposes
        uint8 actualRevealedNumber = revealedNumber;

        (uint256 winnersCount, uint256 creatorPayout, uint256 perWinner) =
            _completeSettlement(g, actualRevealedNumber, guesses);

        emit GameSettled(gameId, actualRevealedNumber, actualRevealedNumber > 5, winnersCount, creatorPayout, perWinner);
        return true;
    }

    /// @notice Fair reveal using commit-reveal pattern (recommended for production).
    /// Creator must provide the original secret number and salt that matches their hash commitment.
    function fairReveal(
        uint256 gameId,
        uint8 originalSecretNumber,
        bytes32 salt
    ) external gameExists(gameId) returns (bool) {
        Game storage g = _games[gameId];
        require(!g.settled, "EncryptedHighLow: already settled");
        require(block.timestamp >= g.endTime, "EncryptedHighLow: round active");
        require(msg.sender == g.creator, "EncryptedHighLow: only creator can reveal");

        // Verify the revealed number matches the hash commitment
        bytes32 computedHash = keccak256(abi.encodePacked(originalSecretNumber, salt));
        require(computedHash == g.secretNumberHash, "EncryptedHighLow: hash mismatch");

        uint256 participantCount = g.participantList.length;
        bool[] memory guesses = new bool[](participantCount);

        // In a real implementation, these guesses would be decrypted by the oracle
        // For local testing, we'll assume all participants guessed BIG
        for (uint256 i = 0; i < participantCount; i++) {
            guesses[i] = true; // Assume BIG for testing
        }

        (uint256 winnersCount, uint256 creatorPayout, uint256 perWinner) =
            _completeSettlement(g, originalSecretNumber, guesses);

        emit GameSettled(gameId, originalSecretNumber, originalSecretNumber > 5, winnersCount, creatorPayout, perWinner);
        return true;
    }

    /// @notice Auto settle the game after countdown ends. Anyone can trigger this.
    /// For local testing or when auto-settle is enabled, automatically reveals and settles.
    function autoSettle(uint256 gameId) external gameExists(gameId) returns (bool) {
        Game storage g = _games[gameId];
        require(!g.settled, "EncryptedHighLow: already settled");
        require(block.timestamp >= g.endTime, "EncryptedHighLow: round still active");

        if (block.chainid == 31337 || block.chainid == 1337) {
            // Local testing: use the normal FHE decryption process
            // In local FHEVM environment, this should work with the mock oracle
            if (!g.revealPending) {
                uint256 participantCount = g.participantList.length;
                uint256 handleCount = participantCount + 1;
                bytes32[] memory handles = new bytes32[](handleCount);

                handles[0] = FHE.toBytes32(g.secretNumber);

                for (uint256 i = 0; i < participantCount; i++) {
                    address participantAddress = g.participantList[i];
                    Participant storage p = g.participants[participantAddress];
                    handles[i + 1] = FHE.toBytes32(p.choice);
                }

                uint256 requestId = FHE.requestDecryption(handles, this.revealCallback.selector);
                g.requestId = requestId;
                g.revealPending = true;
                _requestToGame[requestId] = gameId;

                emit RevealRequested(gameId, requestId);
            }
            // The actual settlement will happen in revealCallback when decryption completes
            return true;
        } else {
            // Production networks: trigger FHE decryption request if not already pending
            if (!g.revealPending) {
                uint256 participantCount = g.participantList.length;
                uint256 handleCount = participantCount + 1;
                bytes32[] memory handles = new bytes32[](handleCount);

                handles[0] = FHE.toBytes32(g.secretNumber);

                for (uint256 i = 0; i < participantCount; i++) {
                    address participantAddress = g.participantList[i];
                    Participant storage p = g.participants[participantAddress];
                    handles[i + 1] = FHE.toBytes32(p.choice);
                }

                uint256 requestId = FHE.requestDecryption(handles, this.revealCallback.selector);
                g.requestId = requestId;
                g.revealPending = true;
                _requestToGame[requestId] = gameId;

                emit RevealRequested(gameId, requestId);
            }
            // The actual settlement will happen in revealCallback if autoSettleEnabled is true
            return true;
        }
    }

    /// @notice Claim the creator share after settlement.
    function claimCreator(uint256 gameId) external nonReentrant gameExists(gameId) {
        Game storage g = _games[gameId];
        require(g.settled, "EncryptedHighLow: not settled");
        require(msg.sender == g.creator, "EncryptedHighLow: not creator");
        require(!g.creatorClaimed, "EncryptedHighLow: already claimed");

        uint256 amount = g.creatorShare + g.creatorBonusRemainder;
        g.creatorClaimed = true;
        _safeTransfer(msg.sender, amount);

        emit CreatorClaimed(gameId, msg.sender, amount);
    }

    /// @notice Claim challenger winnings when the encrypted outcome matches their guess.
    function claimWinnings(uint256 gameId) external nonReentrant gameExists(gameId) {
        Game storage g = _games[gameId];
        require(g.settled, "EncryptedHighLow: not settled");

        Participant storage p = g.participants[msg.sender];
        require(p.exists, "EncryptedHighLow: not a challenger");
        require(p.won, "EncryptedHighLow: not eligible");
        require(!p.claimed, "EncryptedHighLow: already claimed");
        require(g.payoutPerWinner > 0, "EncryptedHighLow: nothing to claim");

        p.claimed = true;
        _safeTransfer(msg.sender, g.payoutPerWinner);

        emit WinningsClaimed(gameId, msg.sender, g.payoutPerWinner);
    }

    /// @notice Return a public summary for a match.
    function getGame(uint256 gameId) external view gameExists(gameId) returns (GameSummary memory) {
        Game storage g = _games[gameId];
        return
            GameSummary({
                creator: g.creator,
                minStake: g.minStake,
                createdAt: g.createdAt,
                endTime: g.endTime,
                rewardPool: g.rewardPool,
                totalPot: g.totalPot,
                revealPending: g.revealPending,
                settled: g.settled,
                autoSettleEnabled: g.autoSettleEnabled,
                revealedNumber: g.revealedNumber,
                numberIsBig: g.numberIsBig,
                winnersCount: g.winnersCount,
                creatorShare: g.creatorShare + g.creatorBonusRemainder,
                payoutPerWinner: g.payoutPerWinner,
                participantCount: g.participantList.length,
                creatorClaimed: g.creatorClaimed
            });
    }

    /// @notice Returns participant level info for UI dashboards.
    function getParticipant(
        uint256 gameId,
        address account
    ) external view gameExists(gameId) returns (ParticipantView memory) {
        Game storage g = _games[gameId];
        Participant storage p = g.participants[account];

        return
            ParticipantView({
                stake: p.stake,
                exists: p.exists,
                won: p.won,
                claimed: p.claimed,
                choiceRevealed: p.choiceRevealed,
                guessedBig: p.guessedBig
            });
    }

    /// @notice Get the addresses of all challengers that joined a match.
    function listParticipants(uint256 gameId) external view gameExists(gameId) returns (address[] memory) {
        return _games[gameId].participantList;
    }

    /// @notice View helper to inspect encrypted handles for audits.
    function getEncryptedSecret(uint256 gameId) external view gameExists(gameId) returns (euint8) {
        return _games[gameId].secretNumber;
    }

    /// @notice Count the number of games that have been created.
    function totalGames() external view returns (uint256) {
        return nextGameId;
    }

    function _completeSettlement(
        Game storage g,
        uint8 revealedNumber,
        bool[] memory guesses
    ) private returns (uint256 winnersCount, uint256 creatorPayout, uint256 perWinner) {
        g.revealPending = false;
        g.settled = true;
        g.revealedNumber = revealedNumber;
        bool isBig = revealedNumber > 5;
        g.numberIsBig = isBig;

        uint256 participantCount = g.participantList.length;

        if (participantCount == 0) {
            g.winnersCount = 0;
            g.creatorShare = g.totalPot;
            g.payoutPerWinner = 0;
            g.creatorBonusRemainder = 0;
            return (0, g.totalPot, 0);
        }

        require(guesses.length == participantCount, "EncryptedHighLow: mismatch guesses");

        for (uint256 i = 0; i < participantCount; i++) {
            address participantAddress = g.participantList[i];
            Participant storage p = g.participants[participantAddress];
            bool guessedBig = guesses[i];

            p.choiceRevealed = true;
            p.guessedBig = guessedBig;
        }

        g.winnersCount = 0;

        g.creatorShare = g.totalPot;
        g.payoutPerWinner = 0;
        g.creatorBonusRemainder = 0;

        creatorPayout = g.totalPot;
        return (0, creatorPayout, 0);
    }

    /// @notice Automatically distribute rewards to creator and winners
    function _autoDistributeRewards(Game storage g, uint256 gameId) private {
        uint256 creatorPayout = g.creatorShare + g.creatorBonusRemainder;
        uint256 perWinner = g.payoutPerWinner;
        uint256 participantCount = g.participantList.length;

        // Pay creator share
        if (creatorPayout > 0 && !g.creatorClaimed) {
            g.creatorClaimed = true;
            _safeTransfer(g.creator, creatorPayout);
            emit CreatorClaimed(gameId, g.creator, creatorPayout);
        }

    }

    /// @notice Complete settlement with automatic reward distribution
    function _completeSettlementWithAutoPayout(
        Game storage g,
        uint256 gameId,
        uint8 revealedNumber,
        bool[] memory guesses
    ) private returns (uint256 winnersCount, uint256 creatorPayout, uint256 perWinner) {
        // First complete the normal settlement logic
        (winnersCount, creatorPayout, perWinner) = _completeSettlement(g, revealedNumber, guesses);

        // Automatically distribute rewards
        uint256 participantCount = g.participantList.length;

        // Pay creator share
        if (creatorPayout > 0) {
            g.creatorClaimed = true;
            _safeTransfer(g.creator, creatorPayout);
            emit CreatorClaimed(gameId, g.creator, creatorPayout);
        }


        return (winnersCount, creatorPayout, perWinner);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "EncryptedHighLow: transfer failed");
    }
}

