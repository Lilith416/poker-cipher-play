import { useMemo, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceStrict } from "date-fns";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { LockKeyhole, Loader2, Timer, Users, Crown, Shield, BookmarkCheck, PlugZap } from "lucide-react";
import { ethers } from "ethers";

import { useToast } from "@/hooks/use-toast";
import { useFhevm } from "@/fhevm/useFhevm";
import { CONTRACT_ADDRESSES, ENCRYPTED_HIGH_LOW_ABI, ZERO_ADDRESS } from "@/config/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type GameSummary = {
  creator: `0x${string}`;
  minStake: bigint;
  createdAt: bigint;
  endTime: bigint;
  rewardPool: bigint;
  totalPot: bigint;
  revealPending: boolean;
  settled: boolean;
  autoSettleEnabled: boolean;
  revealedNumber: number;
  numberIsBig: boolean;
  winnersCount: bigint;
  creatorShare: bigint;
  payoutPerWinner: bigint;
  participantCount: bigint;
  creatorClaimed: boolean;
};

type ParticipantView = {
  stake: bigint;
  exists: boolean;
  won: boolean;
  claimed: boolean;
  choiceRevealed: boolean;
  guessedBig: boolean;
};

type HydratedGame = {
  id: bigint;
  summary: GameSummary;
  participant: ParticipantView;
};

const MOCK_CHAIN_RPC: Record<number, string> = {
  31337: "http://127.0.0.1:8545",
};

const parseGameSummary = (raw: readonly unknown[]): GameSummary => {
  const [
    creator,
    minStake,
    createdAt,
    endTime,
    rewardPool,
    totalPot,
    revealPending,
    settled,
    autoSettleEnabled,
    revealedNumber,
    numberIsBig,
    winnersCount,
    creatorShare,
    payoutPerWinner,
    participantCount,
    creatorClaimed,
  ] = raw as [
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
    boolean,
    boolean,
    number,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  return {
    creator,
    minStake,
    createdAt,
    endTime,
    rewardPool,
    totalPot,
    revealPending,
    settled,
    autoSettleEnabled,
    revealedNumber,
    numberIsBig,
    winnersCount,
    creatorShare,
    payoutPerWinner,
    participantCount,
    creatorClaimed,
  };
};

const parseParticipant = (raw: readonly unknown[]): ParticipantView => {
  const [stake, exists, won, claimed, choiceRevealed, guessedBig] = raw as [
    bigint,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
  ];
  return { stake, exists, won, claimed, choiceRevealed, guessedBig };
};

const MAX_SECRET = 10;
const MIN_SECRET = 1;
const MIN_DURATION_MINUTES = 1;

const defaultCreateForm = {
  secretNumber: 7,
  minStake: "0.010",
  reward: "0.050",
  durationMinutes: "10",
  autoSettle: true,
};

type JoinState = {
  stance: "big" | "small";
  amount: string;
};

const formatTxn = (hash: `0x${string}`) => `${hash.slice(0, 6)}...${hash.slice(-4)}`;
const shorten = (value: `0x${string}`) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const BettingTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient();

  const resolvedChainId = chainId ?? 31337;
  const contractAddress = CONTRACT_ADDRESSES[resolvedChainId];
  const contractReady = contractAddress !== ZERO_ADDRESS;

  const eip1193Provider = useMemo(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum as ethers.Eip1193Provider;
    }
    return undefined;
  }, []);

  const { instance: fhevmInstance, status: fheStatus, error: fheError } = useFhevm({
    provider: eip1193Provider,
    chainId,
    initialMockChains: MOCK_CHAIN_RPC,
    enabled: Boolean(eip1193Provider && contractReady),
  });

  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [joinForms, setJoinForms] = useState<Record<string, JoinState>>({});

  const totalGamesQuery = useQuery({
    queryKey: ["totalGames", resolvedChainId, contractAddress],
    enabled: contractReady,
    queryFn: async () => {
      const total = await publicClient.readContract({
        abi: ENCRYPTED_HIGH_LOW_ABI,
        address: contractAddress,
        functionName: "totalGames",
      });
      return Number(total);
    },
    staleTime: 5_000,
  });

  const gamesQuery = useQuery({
    queryKey: ["games", resolvedChainId, contractAddress, totalGamesQuery.data, address],
    enabled: contractReady && typeof totalGamesQuery.data === "number" && totalGamesQuery.data > 0,
    queryFn: async (): Promise<HydratedGame[]> => {
      console.log("Games query executing with total:", totalGamesQuery.data);
      const total = totalGamesQuery.data ?? 0;
      const ids = Array.from({ length: total }, (_, idx) => BigInt(idx));
      console.log("Game IDs to fetch:", ids);

      const records = await Promise.all(
        ids.map(async (id) => {
          try {
            console.log(`Fetching game ${id}...`);
            const summaryRaw = (await publicClient.readContract({
              abi: ENCRYPTED_HIGH_LOW_ABI,
              address: contractAddress,
              functionName: "getGame",
              args: [id],
            })) as readonly unknown[];

            console.log(`Game ${id} raw data:`, summaryRaw);
            console.log(`Game ${id} raw data type:`, typeof summaryRaw, Array.isArray(summaryRaw));

            // viem should automatically parse structs, use it directly
            const summary = summaryRaw as GameSummary;
            console.log(`Game ${id} parsed summary:`, summary);

            const participantRaw = address
              ? ((await publicClient.readContract({
                  abi: ENCRYPTED_HIGH_LOW_ABI,
                  address: contractAddress,
                  functionName: "getParticipant",
                  args: [id, address],
                })) as readonly unknown[])
              : [0n, false, false, false, false, false];
            console.log(`Game ${id} participant raw:`, participantRaw);
            console.log(`Game ${id} participant raw type:`, typeof participantRaw, Array.isArray(participantRaw));

            // Handle participant data
            let participant: ParticipantView;
            if (address && typeof participantRaw === 'object' && participantRaw !== null && !Array.isArray(participantRaw)) {
              // viem parsed it to an object
              participant = participantRaw as ParticipantView;
            } else {
              // Manual array, parse it
              participant = parseParticipant(participantRaw as readonly unknown[]);
            }
            console.log(`Game ${id} parsed participant:`, participant);

            const result = { id, summary, participant };
            console.log(`Game ${id} final result:`, result);
            return result;
          } catch (error) {
            console.error(`Error fetching game ${id}:`, error);
            // Skip invalid games instead of throwing error
            console.warn(`Skipping game ${id} due to parsing error`);
            return null;
          }
        }),
      );

      // Filter out null records (invalid games)
      const validRecords = records.filter((record): record is HydratedGame => record !== null);

      return validRecords.reverse();
    },
    staleTime: 3_000,
  });

  const refetchGames = () => {
    queryClient.invalidateQueries({ queryKey: ["games", resolvedChainId, contractAddress] });
    queryClient.invalidateQueries({ queryKey: ["totalGames", resolvedChainId, contractAddress] });
  };

  const ensureSigner = () => {
    if (!walletClient || !address) {
      throw new Error("Connect Rainbow wallet first.");
    }
    if (!contractReady) {
      throw new Error("Deploy contract and set address for this network.");
    }
  };

  const handleCreateGame = async () => {
    try {
      ensureSigner();
      if (!fhevmInstance) {
        throw new Error("FHEVM instance not ready yet.");
      }

      const secretNumber = Number(createForm.secretNumber);
      if (Number.isNaN(secretNumber) || secretNumber < MIN_SECRET || secretNumber > MAX_SECRET) {
        throw new Error(`Secret number must be between ${MIN_SECRET} and ${MAX_SECRET}.`);
      }

      const minStakeWei = parseEther(createForm.minStake || "0");
      const rewardWei = parseEther(createForm.reward || "0");
      if (minStakeWei <= 0n) {
        throw new Error("Minimum stake must be greater than zero.");
      }
      if (rewardWei <= 0n) {
        throw new Error("Creator reward must be greater than zero.");
      }

      const durationMinutes = Number(createForm.durationMinutes);
      if (Number.isNaN(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES) {
        throw new Error(`Duration must be at least ${MIN_DURATION_MINUTES} minute.`);
      }

      const endTime = BigInt(Math.floor(Date.now() / 1000) + durationMinutes * 60);

      // Generate a random salt for commit-reveal fairness
      const salt = ethers.hexlify(ethers.randomBytes(32));
      console.log("Generated salt:", salt);

      // Create hash commitment: keccak256(abi.encodePacked(secretNumber, salt))
      const secretNumberHash = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32"], [secretNumber, salt]));
      console.log("Secret number hash commitment:", secretNumberHash);

      console.log("Creating encrypted input for secret number:", secretNumber);
      console.log("FHEVM instance:", fhevmInstance);
      console.log("Contract address:", contractAddress);
      console.log("User address:", address);

      const encryptedInput = await fhevmInstance
        .createEncryptedInput(contractAddress, address as `0x${string}`)
        .add8(secretNumber)
        .encrypt();

      console.log("Encrypted input created:", encryptedInput);
      console.log("handles[0] type:", typeof encryptedInput.handles[0], encryptedInput.handles[0]);
      console.log("inputProof type:", typeof encryptedInput.inputProof, encryptedInput.inputProof);

      // Convert handles[0] to proper format if needed
      let handle = encryptedInput.handles[0];
      if (handle instanceof Uint8Array) {
        // Convert Uint8Array to hex string
        handle = '0x' + Array.from(handle).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof handle === 'string' && !handle.startsWith('0x')) {
        // If it's a string but not hex, assume it's already correct
        handle = handle;
      }

      // Convert inputProof to proper format
      let inputProof = encryptedInput.inputProof;
      if (inputProof instanceof Uint8Array) {
        // Convert Uint8Array to hex string
        inputProof = '0x' + Array.from(inputProof).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      console.log("Converted handle:", handle);
      console.log("Converted inputProof:", inputProof);
      console.log("Using hash commitment:", secretNumberHash);

      const txHash = await walletClient.writeContract({
        account: walletClient.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "createGame",
        args: [handle, inputProof, secretNumberHash, minStakeWei, endTime, rewardWei, createForm.autoSettle],
        value: rewardWei,
      });

      // Note: Game data will be stored after transaction confirmation with gameId

      toast({
        title: "Creating encrypted match…",
        description: "Waiting for confirmation on-chain.",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Get the new game ID from totalGames
      const totalGames = await publicClient.readContract({
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "totalGames",
      });
      const newGameId = totalGames - 1n;

      // Store game data with gameId for later reveal
      const gameData = {
        gameId: newGameId.toString(),
        secretNumber,
        salt,
        creator: address!,
        createdAt: Date.now()
      };
      localStorage.setItem(`game_data_${newGameId}`, JSON.stringify(gameData));
      console.log(`Stored game data for game ${newGameId}:`, gameData);

      toast({
        title: "Match created",
        description: `Encrypted number locked with id ${formatTxn(txHash)}.`,
      });

      setCreateForm(defaultCreateForm);
      refetchGames();
    } catch (error) {
      toast({
        title: "Create failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleJoin = async (game: HydratedGame) => {
    try {
      ensureSigner();
      if (!fhevmInstance) {
        throw new Error("FHEVM instance not ready yet.");
      }
      const joinState = joinForms[game.id.toString()] ?? {
        stance: "big",
        amount: formatEther(game.summary.minStake),
      };
      const stakeAmount = parseEther(joinState.amount || "0");
      if (stakeAmount < game.summary.minStake) {
        throw new Error("Stake must meet game minimum.");
      }

      const wantsBig = joinState.stance === "big";

      const encryptedGuess = await fhevmInstance
        .createEncryptedInput(contractAddress, address as `0x${string}`)
        .addBool(wantsBig)
        .encrypt();

      console.log("Join game encrypted guess:", encryptedGuess);

      let guessHandle = encryptedGuess.handles[0];
      if (guessHandle instanceof Uint8Array) {
        guessHandle = '0x' + Array.from(guessHandle).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof guessHandle === 'string' && !guessHandle.startsWith('0x')) {
        guessHandle = guessHandle;
      }

      let guessInputProof = encryptedGuess.inputProof;
      if (guessInputProof instanceof Uint8Array) {
        guessInputProof = '0x' + Array.from(guessInputProof).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      console.log("Join game converted handle:", guessHandle);
      console.log("Join game converted inputProof:", guessInputProof);

      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "joinGame",
        args: [game.id, guessHandle, guessInputProof],
        value: stakeAmount,
      });

      toast({
        title: "Joining match",
        description: "Encrypted stance broadcast to contract.",
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      toast({
        title: "Joined successfully",
        description: `You locked a ${wantsBig ? "BIG" : "SMALL"} stance.`,
      });

      refetchGames();
    } catch (error) {
      toast({
        title: "Join failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleRequestReveal = async (gameId: bigint) => {
    try {
      ensureSigner();
      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "requestReveal",
        args: [gameId],
      });

      toast({ title: "Reveal requested", description: "Awaiting oracle decryption." });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error) {
      toast({
        title: "Reveal failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleFairReveal = async (gameId: bigint, secretNumber: number, salt: `0x${string}`) => {
    // Ensure salt is in correct format (bytes32 = 66 chars including 0x)
    let formattedSalt: `0x${string}` = salt;
    if (!salt.startsWith('0x')) {
      formattedSalt = `0x${salt}` as `0x${string}`;
    }
    // Ensure salt is exactly 32 bytes (66 chars)
    if (formattedSalt.length !== 66) {
      const saltBytes = ethers.getBytes(formattedSalt);
      const padded = new Uint8Array(32);
      padded.set(saltBytes.slice(0, 32));
      formattedSalt = ethers.hexlify(padded) as `0x${string}`;
    }

    try {
      ensureSigner();

      console.log("Fair reveal - gameId:", gameId, "secretNumber:", secretNumber, "salt:", formattedSalt);

      // For debugging: let's compute the hash that should match
      const ethers = await import('ethers');
      const computedHash = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32"], [secretNumber, formattedSalt]));
      console.log("Computed hash for verification:", computedHash);

      // Try to get the stored hash from the contract for comparison
      try {
        const gameSummary = await publicClient.readContract({
          address: contractAddress,
          abi: ENCRYPTED_HIGH_LOW_ABI,
          functionName: "getGame",
          args: [gameId],
        });
        console.log("Game summary:", gameSummary);
        // Note: secretNumberHash is not in GameSummary, but we can check other fields
      } catch (e) {
        console.warn("Could not fetch game summary:", e);
      }

      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "fairReveal",
        args: [gameId, secretNumber, formattedSalt],
      });

      toast({ title: "Fair reveal executed", description: `Game settled with committed secret number ${secretNumber}.` });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error: any) {
      console.error("Fair reveal failed:", error);

      // Try to extract the actual revert reason from the error
      let errorMessage = "Fair reveal failed";
      let detailedMessage = (error as Error).message;

      // Check for viem contract errors
      if (error?.cause?.data) {
        const data = error.cause.data;
        if (data.startsWith("0x08c379a0")) {
          // Error(string) selector
          try {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ["string"],
              "0x" + data.slice(10)
            );
            detailedMessage = decoded[0];
          } catch (e) {
            console.error("Failed to decode error:", e);
          }
        }
      }

      // Check error message for specific revert reasons
      if (detailedMessage.includes("hash mismatch") || detailedMessage.includes("EncryptedHighLow: hash mismatch")) {
        errorMessage = "Hash verification failed";
        detailedMessage = "The provided secret number and salt don't match the original commitment. Please verify:\n1. Secret number is correct (1-10)\n2. Salt matches the one used when creating the game\n3. The hash computed from these values matches the stored commitment.";
      } else if (detailedMessage.includes("only creator") || detailedMessage.includes("EncryptedHighLow: only creator")) {
        errorMessage = "Unauthorized";
        detailedMessage = "Only the game creator can perform fair reveal.";
      } else if (detailedMessage.includes("round active") || detailedMessage.includes("EncryptedHighLow: round active")) {
        errorMessage = "Game still active";
        detailedMessage = "Cannot reveal yet - the game round is still active. Please wait until the end time.";
      } else if (detailedMessage.includes("already settled") || detailedMessage.includes("EncryptedHighLow: already settled")) {
        errorMessage = "Game already settled";
        detailedMessage = "This game has already been settled.";
      } else if (detailedMessage.includes("Internal JSON-RPC error")) {
        errorMessage = "Transaction failed";
        detailedMessage = "The transaction was reverted. This could be due to:\n1. Hash mismatch (wrong secret number or salt)\n2. Game state (already settled or still active)\n3. Permission (not the creator)\n\nCheck the console for more details.";
      }

      // Compute hash for debugging
      let computedHashForDebug = "";
      try {
        const ethers = await import('ethers');
        computedHashForDebug = ethers.keccak256(ethers.solidityPacked(["uint8", "bytes32"], [secretNumber, formattedSalt]));
      } catch (e) {
        console.warn("Could not compute hash for debug:", e);
      }

      console.error("Error details:", {
        error,
        computedHash: computedHashForDebug,
        secretNumber,
        salt: formattedSalt,
        gameId
      });

      toast({
        title: errorMessage,
        description: detailedMessage,
        variant: "destructive",
      });
    }
  };

  const handleAutoSettle = async (gameId: bigint) => {
    try {
      ensureSigner();

      console.log("Auto settling game:", gameId);

      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "autoSettle",
        args: [gameId],
      });

      toast({
        title: "Auto settlement executed",
        description: "Game settled automatically with rewards distributed.",
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error) {
      console.error("Auto settle failed:", error);
      toast({
        title: "Auto settle failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  // Helper function to find stored game data
  const findStoredGameData = (gameId?: bigint): { secretNumber: number; salt: string } | null => {
    // If gameId is provided, try to find data for that specific game
    if (gameId !== undefined) {
      const key = `game_data_${gameId}`;
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.creator?.toLowerCase() === address?.toLowerCase()) {
            return { secretNumber: parsed.secretNumber, salt: parsed.salt };
          }
        } catch (e) {
          console.error("Failed to parse game data:", e);
          localStorage.removeItem(key);
        }
      }
    }

    // Fallback: search all game data entries
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('game_data_') || key.startsWith('temp_game_data_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          if (data.creator?.toLowerCase() === address?.toLowerCase()) {
            // If gameId is provided, only return if it matches
            if (gameId !== undefined && data.gameId !== undefined) {
              if (BigInt(data.gameId) === gameId) {
                return { secretNumber: data.secretNumber, salt: data.salt };
              }
            } else {
              // Otherwise return the most recent one (within 24 hours)
              const age = Date.now() - (data.createdAt || 0);
              if (age < 24 * 60 * 60 * 1000) {
                return { secretNumber: data.secretNumber, salt: data.salt };
              } else {
                localStorage.removeItem(key);
              }
            }
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    }
    return null;
  };

  const handleDebugReveal = async (gameId: bigint, secretNumber?: number) => {
    try {
      ensureSigner();

      // If no secret number provided, try to find it from localStorage
      let actualSecretNumber = secretNumber;
      if (actualSecretNumber === undefined) {
        actualSecretNumber = findStoredSecret(gameId);
        if (actualSecretNumber === null) {
          toast({
            title: "Cannot find stored secret",
            description: "Please provide the secret number manually or use Fair Reveal with salt",
            variant: "destructive",
          });
          return;
        }
      }

      // Get all participants
      const participantList = await publicClient.readContract({
        abi: ENCRYPTED_HIGH_LOW_ABI,
        address: contractAddress,
        functionName: "listParticipants",
        args: [gameId],
      }) as `0x${string}`[];

      console.log("Participants:", participantList);

      // Get game data to check encrypted choices
      const gameData = await publicClient.readContract({
        abi: ENCRYPTED_HIGH_LOW_ABI,
        address: contractAddress,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      console.log("Game data:", gameData);

      // For local development, we need to provide guesses manually
      // In a real FHEVM oracle environment, this would be handled automatically
      // For now, we'll assume all participants guessed BIG (true) for simplicity
      // You can modify this logic based on your testing needs
      const guesses: boolean[] = new Array(participantList.length).fill(true);

      console.log("Using default guesses (all BIG):", guesses);
      console.log("Note: In production, FHEVM oracle would decrypt actual participant choices.");

      console.log("Debug reveal - gameId:", gameId, "secretNumber:", actualSecretNumber, "guesses:", guesses);

      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "debugReveal",
        args: [gameId, actualSecretNumber, guesses],
      });

      toast({ title: "Debug reveal executed", description: `Game settled with secret number ${actualSecretNumber}.` });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error) {
      console.error("Debug reveal failed:", error);
      toast({
        title: "Debug reveal failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleClaimCreator = async (gameId: bigint) => {
    try {
      ensureSigner();
      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "claimCreator",
        args: [gameId],
      });

      toast({ title: "Claiming creator share" });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error) {
      toast({
        title: "Claim failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleClaimWinnings = async (gameId: bigint) => {
    try {
      ensureSigner();
      const txHash = await walletClient!.writeContract({
        account: walletClient!.account.address,
        chainId: resolvedChainId,
        address: contractAddress,
        abi: ENCRYPTED_HIGH_LOW_ABI,
        functionName: "claimWinnings",
        args: [gameId],
      });

      toast({ title: "Claiming winnings" });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      refetchGames();
    } catch (error) {
      toast({
        title: "Claim failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const renderStatus = (game: GameSummary) => {
    if (game.settled) {
      return <Badge className="bg-emerald-500/15 text-emerald-400">Settled</Badge>;
    }
    if (game.revealPending) {
      return <Badge className="bg-amber-500/15 text-amber-400">Reveal pending</Badge>;
    }
    return <Badge variant="outline">Open</Badge>;
  };

  const handleJoinFieldChange = (gameId: bigint, value: Partial<JoinState>) => {
    setJoinForms((prev) => {
      const key = gameId.toString();
      const existing = prev[key] ?? { stance: "big", amount: "" };
      return { ...prev, [key]: { ...existing, ...value } };
    });
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-border/40 bg-gradient-to-br from-background via-background/80 to-background p-8 shadow-lg shadow-black/5">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">
              <LockKeyhole className="h-4 w-4 text-primary" />
              Creator workflow
            </div>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Launch an encrypted high–low round</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You deposit the reward pool, set a secret number, and define the minimum stake and expiry timer.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2 text-sm text-primary">
            <Shield className="h-4 w-4" />
            FHEVM-secured inputs
          </div>
        </header>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="secretNumber">Secret number (1-10)</Label>
            <Input
              id="secretNumber"
              type="number"
              min={MIN_SECRET}
              max={MAX_SECRET}
              value={createForm.secretNumber}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, secretNumber: Number(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minStake">Minimum stake (ETH)</Label>
            <Input
              id="minStake"
              type="number"
              min="0"
              step="0.001"
              value={createForm.minStake}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, minStake: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward">Creator reward pool (ETH)</Label>
            <Input
              id="reward"
              type="number"
              min="0"
              step="0.001"
              value={createForm.reward}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, reward: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min={MIN_DURATION_MINUTES}
              step="1"
              value={createForm.durationMinutes}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, durationMinutes: event.target.value }))
              }
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autoSettle"
              checked={createForm.autoSettle}
              onCheckedChange={(checked) =>
                setCreateForm((prev) => ({ ...prev, autoSettle: checked as boolean }))
              }
            />
            <Label htmlFor="autoSettle" className="text-sm">
              Enable automatic settlement
            </Label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <BookmarkCheck className="h-4 w-4 text-primary" />
            {createForm.autoSettle
              ? "Secret number, wagers, and stances stay encrypted until countdown ends, then automatically revealed and settled."
              : "Secret number, wagers, and stances stay encrypted until you or another player triggers the reveal."
            }
          </div>
          <Button
            size="lg"
            disabled={!isConnected || !contractReady || fheStatus !== "ready"}
            onClick={handleCreateGame}
            className="gap-2"
          >
            {fheStatus !== "ready" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Publish encrypted match
          </Button>
        </div>

        {!contractReady && (
          <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-primary">
            Provide a deployed contract address for chain {resolvedChainId} inside <code>config/contracts.ts</code> to
            enable matchmaking.
          </div>
        )}

      </section>

      <section className="space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              Open matches
            </div>
            <h3 className="text-2xl font-semibold text-foreground">Matchmaking lobby</h3>
            <p className="text-sm text-muted-foreground">
              Join a match, choose big (6-10) or small (1-5), stake at least the minimum, and wait for the reveal.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1 py-1">
            <Timer className="h-3.5 w-3.5" />
            {totalGamesQuery.data ?? 0} total matches
          </Badge>
        </header>

        {gamesQuery.isLoading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/10 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching live games from contract…
          </div>
        ) : gamesQuery.data && gamesQuery.data.length > 0 ? (
          <div className="space-y-6">
            {gamesQuery.data.map((game) => {
              const participant = game.participant;
              const summary = game.summary;
              const joinState = joinForms[game.id.toString()] ?? {
                stance: "big",
                amount: formatEther(summary.minStake),
              };
              const now = Date.now();
              const secondsUntilEnd = Number(summary.endTime) * 1000 - now;
              const canJoin =
                !summary.settled &&
                !summary.revealPending &&
                secondsUntilEnd > 0 &&
                !participant.exists &&
                isConnected;

              const deadlineLabel =
                secondsUntilEnd > 0
                  ? formatDistanceStrict(new Date(Number(summary.endTime) * 1000), new Date())
                  : "Expired";

              const youAreCreator = address && summary.creator.toLowerCase() === address.toLowerCase();

              return (
                <article
                  key={game.id.toString()}
                  className="rounded-2xl border border-border/40 bg-background/80 p-6 shadow-sm shadow-black/5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Match #{game.id.toString().padStart(3, "0")}
                        </span>
                        <span>Creator: {shorten(summary.creator)}</span>
                        {youAreCreator && <Badge className="bg-primary/10 text-primary">You</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Crown className="h-3.5 w-3.5 text-primary" />
                        Creator earns 50% of the final pot and any rounding remainder.
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {renderStatus(summary)}
                      {summary.endTime > now && (
                        <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                          <Timer className="h-3.5 w-3.5" />
                          Ends in{" "}
                          {formatDistanceStrict(new Date(Number(summary.endTime) * 1000), new Date())}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Minimum stake</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatEther(summary.minStake)} <span className="text-xs text-muted-foreground">ETH</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Pot (encrypted)</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatEther(summary.totalPot)} <span className="text-xs text-muted-foreground">ETH</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Participants</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {summary.participantCount.toString()}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-sm">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Reward funded</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatEther(summary.rewardPool)} <span className="text-xs text-muted-foreground">ETH</span>
                      </div>
                    </div>
                  </div>

                  {summary.settled && (
                    <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                      Secret number decrypted as <strong>{summary.revealedNumber}</strong> (
                      {summary.numberIsBig ? "BIG" : "SMALL"}). Winners: {summary.winnersCount.toString()} · Winner share: {" "}
                      {formatEther(summary.payoutPerWinner)} ETH.
                    </div>
                  )}

                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Encrypted stance
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/10 p-2">
                          <Button
                            type="button"
                            variant={joinState.stance === "small" ? "default" : "outline"}
                            className={cn("flex-1", joinState.stance === "small" && "bg-primary text-primary-foreground")}
                            onClick={() => handleJoinFieldChange(game.id, { stance: "small" })}
                            disabled={!canJoin}
                          >
                            Small (1-5)
                          </Button>
                          <Button
                            type="button"
                            variant={joinState.stance === "big" ? "default" : "outline"}
                            className={cn("flex-1", joinState.stance === "big" && "bg-primary text-primary-foreground")}
                            onClick={() => handleJoinFieldChange(game.id, { stance: "big" })}
                            disabled={!canJoin}
                          >
                            Big (6-10)
                          </Button>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={joinState.amount}
                          onChange={(event) => handleJoinFieldChange(game.id, { amount: event.target.value })}
                          disabled={!canJoin}
                          placeholder={formatEther(summary.minStake)}
                        />
                      </div>

                      <div className="flex flex-col gap-3">
                        <Button
                          disabled={!canJoin}
                          onClick={() => handleJoin(game)}
                          className="w-full gap-2"
                        >
                          {canJoin ? "Join encrypted match" : "Joining closed"}
                        </Button>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Button
                            variant="secondary"
                            disabled={
                              !youAreCreator || summary.creatorClaimed || !summary.settled || summary.creatorShare === 0n
                            }
                            onClick={() => handleClaimCreator(game.id)}
                          >
                            Claim creator share
                          </Button>

                          <Button
                            variant="secondary"
                            disabled={!participant.exists || !participant.won || participant.claimed}
                            onClick={() => handleClaimWinnings(game.id)}
                          >
                            Claim winnings
                          </Button>
                        </div>

                      </div>

                      <div className="space-y-2 rounded-xl border border-border/20 bg-muted/5 p-3 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Reveal window</span>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={summary.settled || summary.revealPending || secondsUntilEnd > 0}
                              onClick={() => handleRequestReveal(game.id)}
                            >
                              Request reveal
                            </Button>

                            {/* Fair Reveal - commit-reveal pattern */}
                            {summary.creator.toLowerCase() === address?.toLowerCase() && (
                              <div className="flex flex-col gap-2">
                                <div className="text-xs text-muted-foreground">
                                  Fair Reveal (commit-reveal pattern)
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs w-full"
                                  disabled={summary.settled || secondsUntilEnd > 0}
                                  onClick={() => {
                                    // Automatically find game data from localStorage
                                    const gameData = findStoredGameData(game.id);
                                    if (gameData) {
                                      handleFairReveal(game.id, gameData.secretNumber, gameData.salt as `0x${string}`);
                                    } else {
                                      toast({
                                        title: "Game data not found",
                                        description: "Could not find stored game data for this game. The game may have been created in a different session.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  Fair Reveal
                                </Button>
                              </div>
                            )}

                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>My status</span>
                          <span className="font-medium text-foreground">
                            {participant.exists
                              ? participant.won
                                ? participant.claimed
                                  ? "Claimed"
                                  : "Eligible to claim"
                                : "Participated"
                              : "Not joined"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {participant.exists && (
                    <div className="mt-4 rounded-xl border border-border/30 bg-muted/5 p-3 text-xs text-muted-foreground">
                      You joined staking {formatEther(participant.stake)} ETH · You selected {" "}
                      <span className="font-semibold text-foreground">
                        {participant.choiceRevealed ? (participant.guessedBig ? "BIG" : "SMALL") : "encrypted"}
                      </span>
                      .
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/30 p-6 text-sm text-muted-foreground">
            No matches yet — deploy the contract locally, create a round, and it will appear here automatically.
          </div>
        )}
      </section>

      {!isConnected && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-sm text-primary">
          <PlugZap className="h-4 w-4" />
          Connect RainbowKit in the header to encrypt inputs and interact with the contract.
        </div>
      )}
    </div>
  );
};

export default BettingTable;

