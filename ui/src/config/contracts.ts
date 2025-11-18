export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  31337: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  11155111: "0x289F52A85094aDbD88d9186CbB6cf7375A4c8630",
};

export function getContractAddress(chainId: number): `0x${string}` {
  return CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[11155111];
}

export const ENCRYPTED_HIGH_LOW_ABI = [
  { "inputs": [], "name": "HandlesAlreadySavedForRequestID", "type": "error" },
  { "inputs": [], "name": "InvalidKMSSignatures", "type": "error" },
  { "inputs": [], "name": "NoHandleFoundForRequestID", "type": "error" },
  { "inputs": [], "name": "ReentrancyGuardReentrantCall", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "CreatorClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "uint256", "name": "requestID", "type": "uint256" }],
    "name": "DecryptionFulfilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "minStake", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "rewardPool", "type": "uint256" }
    ],
    "name": "GameCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "stake", "type": "uint256" }
    ],
    "name": "GameJoined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": false, "internalType": "uint8", "name": "revealedNumber", "type": "uint8" },
      { "indexed": false, "internalType": "bool", "name": "numberIsBig", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "winnersCount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "creatorShare", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "payoutPerWinner", "type": "uint256" }
    ],
    "name": "GameSettled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "name": "RevealRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "WinningsClaimed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MIN_CREATOR_REWARD",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_DURATION",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_STAKE",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "claimCreator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "secretNumberHandle", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" },
      { "internalType": "bytes32", "name": "secretNumberHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "minStake", "type": "uint256" },
      { "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardPool", "type": "uint256" },
      { "internalType": "bool", "name": "enableAutoSettle", "type": "bool" }
    ],
    "name": "createGame",
    "outputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "internalType": "uint8", "name": "revealedNumber", "type": "uint8" },
      { "internalType": "bool[]", "name": "guesses", "type": "bool[]" }
    ],
    "name": "debugReveal",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "internalType": "uint8", "name": "originalSecretNumber", "type": "uint8" },
      { "internalType": "bytes32", "name": "salt", "type": "bytes32" }
    ],
    "name": "fairReveal",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "autoSettle",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "getEncryptedSecret",
    "outputs": [{ "internalType": "euint8", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "getGame",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "creator", "type": "address" },
          { "internalType": "uint256", "name": "minStake", "type": "uint256" },
          { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
          { "internalType": "uint256", "name": "endTime", "type": "uint256" },
          { "internalType": "uint256", "name": "rewardPool", "type": "uint256" },
          { "internalType": "uint256", "name": "totalPot", "type": "uint256" },
          { "internalType": "bool", "name": "revealPending", "type": "bool" },
          { "internalType": "bool", "name": "settled", "type": "bool" },
          { "internalType": "bool", "name": "autoSettleEnabled", "type": "bool" },
          { "internalType": "uint8", "name": "revealedNumber", "type": "uint8" },
          { "internalType": "bool", "name": "numberIsBig", "type": "bool" },
          { "internalType": "uint256", "name": "winnersCount", "type": "uint256" },
          { "internalType": "uint256", "name": "creatorShare", "type": "uint256" },
          { "internalType": "uint256", "name": "payoutPerWinner", "type": "uint256" },
          { "internalType": "uint256", "name": "participantCount", "type": "uint256" },
          { "internalType": "bool", "name": "creatorClaimed", "type": "bool" }
        ],
        "internalType": "struct EncryptedHighLow.GameSummary",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "getParticipant",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "stake", "type": "uint256" },
          { "internalType": "bool", "name": "exists", "type": "bool" },
          { "internalType": "bool", "name": "won", "type": "bool" },
          { "internalType": "bool", "name": "claimed", "type": "bool" },
          { "internalType": "bool", "name": "choiceRevealed", "type": "bool" },
          { "internalType": "bool", "name": "guessedBig", "type": "bool" }
        ],
        "internalType": "struct EncryptedHighLow.ParticipantView",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "gameId", "type": "uint256" },
      { "internalType": "externalEbool", "name": "guessHandle", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "joinGame",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "listParticipants",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextGameId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "protocolId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "gameId", "type": "uint256" }],
    "name": "requestReveal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "internalType": "bytes", "name": "cleartexts", "type": "bytes" },
      { "internalType": "bytes", "name": "decryptionProof", "type": "bytes" }
    ],
    "name": "revealCallback",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalGames",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

