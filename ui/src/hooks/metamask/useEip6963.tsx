import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip6963Provider;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963Provider extends EventTarget {
  isMetaMask?: boolean;
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on(event: "connect", listener: (connectInfo: { chainId: string }) => void): void;
  on(event: "disconnect", listener: (error: { code: number; message: string }) => void): void;
  on(event: "chainChanged", listener: (chainId: string) => void): void;
  on(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

export interface UseEip6963State {
  providers: Eip6963ProviderDetail[];
  error: Error | undefined;
}

function useEip6963Internal(): UseEip6963State {
  const [providers, setProviders] = useState<Eip6963ProviderDetail[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    const onAnnounceProvider = (event: CustomEvent<Eip6963ProviderDetail>) => {
      setProviders((prevProviders) => {
        const exists = prevProviders.some((p) => p.info.uuid === event.detail.info.uuid);
        if (exists) {
          return prevProviders;
        }
        return [...prevProviders, event.detail];
      });
    };

    window.addEventListener("eip6963:announceProvider", onAnnounceProvider as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounceProvider as EventListener);
    };
  }, []);

  return { providers, error };
}

interface Eip6963ProviderProps {
  children: ReactNode;
}

const Eip6963Context = createContext<UseEip6963State | undefined>(undefined);

export const Eip6963Provider: React.FC<Eip6963ProviderProps> = ({ children }) => {
  const { providers, error } = useEip6963Internal();
  return (
    <Eip6963Context.Provider value={{ providers, error }}>
      {children}
    </Eip6963Context.Provider>
  );
};

export function useEip6963() {
  const context = useContext(Eip6963Context);
  if (context === undefined) {
    throw new Error("useEip6963 must be used within an Eip6963Provider");
  }
  return context;
}
