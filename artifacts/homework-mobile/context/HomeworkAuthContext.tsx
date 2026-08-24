import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const TOKEN_STORAGE_KEY = "homework-companion.magic-token";

type HomeworkAuthContextValue = {
  token: string | null;
  isReady: boolean;
  saveToken: (token: string) => void;
  clearToken: () => void;
};

const HomeworkAuthContext = createContext<HomeworkAuthContextValue | null>(null);

export function HomeworkAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasExplicitToken = useRef(false);

  useEffect(() => {
    void SecureStore.getItemAsync(TOKEN_STORAGE_KEY)
      .then((storedToken) => {
        if (!hasExplicitToken.current) setToken(storedToken);
      })
      .finally(() => setIsReady(true));
  }, []);

  const value: HomeworkAuthContextValue = {
    token,
    isReady,
    saveToken: (newToken) => {
      hasExplicitToken.current = true;
      setToken(newToken);
      void SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newToken);
    },
    clearToken: () => {
      hasExplicitToken.current = true;
      setToken(null);
      void SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    },
  };

  return <HomeworkAuthContext.Provider value={value}>{children}</HomeworkAuthContext.Provider>;
}

export function useHomeworkAuth() {
  const context = useContext(HomeworkAuthContext);
  if (!context) throw new Error("useHomeworkAuth must be used inside HomeworkAuthProvider");
  return context;
}