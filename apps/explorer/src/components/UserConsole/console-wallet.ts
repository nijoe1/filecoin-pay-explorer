import type { ConnectedWallet, User } from "@privy-io/react-auth";

type WalletLike = Pick<ConnectedWallet, "address" | "walletClientType">;

export function isPrivyEmbeddedWallet(wallet: Pick<ConnectedWallet, "walletClientType">): boolean {
  return wallet.walletClientType === "privy";
}

/**
 * Chooses which Privy wallet wagmi, and therefore the console, acts as.
 *
 * Privy's wagmi bridge otherwise activates every newly connected wallet, which
 * turned "connect another wallet to fund this account" into "switch accounts".
 * Priority: the embedded wallet, then the wallet the user logged in with, then
 * whatever was active last, then the first connected wallet.
 */
export function createConsoleWalletSelector() {
  let lastAddress: string | undefined;
  return <T extends WalletLike>({
    wallets,
    user,
  }: {
    wallets: T[];
    user: Pick<User, "wallet"> | null;
  }): T | undefined => {
    const byAddress = (address: string | undefined) =>
      address ? wallets.find((wallet) => wallet.address.toLowerCase() === address.toLowerCase()) : undefined;
    const selected =
      wallets.find(isPrivyEmbeddedWallet) ?? byAddress(user?.wallet?.address) ?? byAddress(lastAddress) ?? wallets[0];
    lastAddress = selected?.address;
    return selected;
  };
}
