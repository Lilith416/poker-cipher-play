import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

export const appChains = [hardhat, sepolia] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Cipher High-Low",
  projectId: "88306a972a77389d91871e08d26516af", // Replace with your WalletConnect project ID
  chains: appChains,
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(`https://sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_API_KEY || 'b18fb7e6ca7045ac83c41157ab93f990'}`),
  },
  ssr: false,
});
