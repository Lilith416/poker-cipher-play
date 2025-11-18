"use client";

import type { ReactNode } from "react";

import { Eip6963Provider } from "@/hooks/metamask/useEip6963";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <Eip6963Provider>
      <MetaMaskProvider>
        <MetaMaskEthersSignerProvider initialMockChains={{ 31337: "http://localhost:8545" }}>
          <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
        </MetaMaskEthersSignerProvider>
      </MetaMaskProvider>
    </Eip6963Provider>
  );
}
