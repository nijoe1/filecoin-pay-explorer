import type { SquidDepositStage } from "../../data/squid-deposit-execution";

/** The execution stages plus the moment before the route is requested. */
export type UiStage = SquidDepositStage | "preparing";

/**
 * What the user should do or wait for at each stage. A first purchase signs a
 * USDC approval before the swap, so those two signatures are numbered.
 */
export function describeStage(
  stage: UiStage,
  { hasApproved, isEmbedded }: { hasApproved: boolean; isEmbedded: boolean },
): string {
  switch (stage) {
    case "preparing":
      return "Preparing the route…";
    case "approving":
      return isEmbedded
        ? "Step 1 of 2: approving USDC with your Privy wallet…"
        : "Step 1 of 2: approve USDC in your wallet";
    case "swap-requested":
      if (isEmbedded) {
        return hasApproved
          ? "Step 2 of 2: signing the swap with your Privy wallet…"
          : "Signing the swap with your Privy wallet…";
      }
      return hasApproved ? "Step 2 of 2: confirm the swap in your wallet" : "Confirm the swap in your wallet";
    case "swap-broadcast":
      return "Waiting for the source network to confirm…";
    case "bridging":
      return "Bridging to Filecoin and depositing. This takes about two minutes.";
    case "verifying":
      return "Confirming your Filecoin Pay balance…";
  }
}
