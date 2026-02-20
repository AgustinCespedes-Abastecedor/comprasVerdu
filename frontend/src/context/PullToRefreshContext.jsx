import React, { createContext, useContext, useState, useCallback } from 'react';

export const PullToRefreshContext = createContext(null);

export function PullToRefreshProvider({ children }) {
  const [scrollContainer, setScrollContainer] = useState(null);
  const [refreshCallback, setRefreshCallback] = useState(null);

  const registerScrollContainer = useCallback((el) => {
    setScrollContainer(el);
  }, []);

  const registerRefresh = useCallback((fn) => {
    setRefreshCallback(() => fn);
  }, []);

  return (
    <PullToRefreshContext.Provider
      value={{
        scrollContainer,
        refreshCallback,
        registerScrollContainer,
        registerRefresh,
      }}
    >
      {children}
    </PullToRefreshContext.Provider>
  );
}

export function usePullToRefresh() {
  const ctx = useContext(PullToRefreshContext);
  if (!ctx) return { registerScrollContainer: () => {}, registerRefresh: () => {} };
  return {
    registerScrollContainer: ctx.registerScrollContainer,
    registerRefresh: ctx.registerRefresh,
  };
}
