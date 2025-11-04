import { createContext, ReactNode, useContext, useRef } from "react";

export interface InMemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class InMemoryStorageImpl implements InMemoryStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }
}

function useInMemoryStorageInternal(): InMemoryStorage {
  const storageRef = useRef<InMemoryStorage>(new InMemoryStorageImpl());
  return storageRef.current;
}

interface InMemoryStorageProviderProps {
  children: ReactNode;
}

const InMemoryStorageContext = createContext<InMemoryStorage | undefined>(
  undefined
);

export const InMemoryStorageProvider: React.FC<InMemoryStorageProviderProps> = ({
  children,
}) => {
  const storage = useInMemoryStorageInternal();
  return (
    <InMemoryStorageContext.Provider value={storage}>
      {children}
    </InMemoryStorageContext.Provider>
  );
};

export function useInMemoryStorage() {
  const context = useContext(InMemoryStorageContext);
  if (context === undefined) {
    throw new Error(
      "useInMemoryStorage must be used within an InMemoryStorageProvider"
    );
  }
  return context;
}