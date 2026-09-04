export type WalletEntryState = "loading" | "login" | "preparing" | "connected";
export type WalletExitAction = "logout" | "disconnect";

export const getWalletEntryState = ({
  ready,
  walletsReady,
  authenticated,
  isConnected,
}: {
  ready: boolean;
  walletsReady: boolean;
  authenticated: boolean;
  isConnected: boolean;
}): WalletEntryState => {
  if (!ready || !walletsReady) return "loading";
  if (isConnected) return "connected";
  if (authenticated) return "preparing";
  return "login";
};

export const getWalletExitAction = (authenticated: boolean): WalletExitAction =>
  authenticated ? "logout" : "disconnect";

export const exitWalletSession = async ({
  authenticated,
  logout,
  disconnect,
  pauseSelection,
  resumeSelection,
}: {
  authenticated: boolean;
  logout: () => Promise<void>;
  disconnect?: () => void;
  pauseSelection?: () => void;
  resumeSelection?: () => void;
}) => {
  // Pausing first keeps the wagmi bridge from re-selecting the same wallet
  // the moment its connection is dropped.
  pauseSelection?.();
  try {
    if (authenticated) return await logout();
    if (!disconnect) throw new Error("Connected wallet was not found");
    disconnect();
  } catch (error) {
    resumeSelection?.();
    throw error;
  }
};
