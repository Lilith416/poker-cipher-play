import { createContext, ReactNode, useContext, useMemo } from "react";
import { ethers } from "ethers";
import { useMetaMask } from "./useMetaMaskProvider";

export interface UseMetaMaskEthersSignerState {
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
}

function useMetaMaskEthersSignerInternal(
  initialMockChains?: Record<number, string>
): UseMetaMaskEthersSignerState {
  const { provider, accounts, chainId } = useMetaMask();

  const ethersSigner = useMemo(() => {
    if (!provider || !accounts || accounts.length === 0) {
      return undefined;
    }

    const ethersProvider = new ethers.BrowserProvider(provider);
    return ethersProvider.getSigner();
  }, [provider, accounts]);

  const ethersReadonlyProvider = useMemo(() => {
    if (!provider) {
      return undefined;
    }

    const _mockChains: Record<number, string> = {
      31337: "http://localhost:8545",
      ...(initialMockChains ?? {}),
    };

    if (chainId && Object.hasOwn(_mockChains, chainId)) {
      return new ethers.JsonRpcProvider(_mockChains[chainId]);
    }

    return new ethers.BrowserProvider(provider);
  }, [provider, chainId, initialMockChains]);

  return {
    ethersSigner,
    ethersReadonlyProvider,
  };
}

interface MetaMaskEthersSignerProviderProps {
  children: ReactNode;
  initialMockChains?: Record<number, string>;
}

const MetaMaskEthersSignerContext =
  createContext<UseMetaMaskEthersSignerState | undefined>(undefined);

export const MetaMaskEthersSignerProvider: React.FC<
  MetaMaskEthersSignerProviderProps
> = ({ children, initialMockChains }) => {
  const { ethersSigner, ethersReadonlyProvider } =
    useMetaMaskEthersSignerInternal(initialMockChains);
  return (
    <MetaMaskEthersSignerContext.Provider
      value={{
        ethersSigner,
        ethersReadonlyProvider,
      }}
    >
      {children}
    </MetaMaskEthersSignerContext.Provider>
  );
};

export function useMetaMaskEthersSigner() {
  const context = useContext(MetaMaskEthersSignerContext);
  if (context === undefined) {
    throw new Error(
      "useMetaMaskEthersSigner must be used within a MetaMaskEthersSignerProvider"
    );
  }
  return context;
}
