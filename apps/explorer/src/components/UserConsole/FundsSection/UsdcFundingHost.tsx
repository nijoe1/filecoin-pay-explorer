"use client";

import { useConnection } from "wagmi";
import { useFundingLaunch } from "@/components/UserConsole/FundingLaunchContext";
import { FundWithUsdcDialog } from "./components";
import { isUsdcFundingAvailable } from "./data/usdc-funding-availability";

/**
 * The single place the "Pay with USDC" dialog is rendered. It lives in the
 * console layout so the wallet menu can open it from any console page, and
 * it keys on the address so a change of identity starts the dialog fresh.
 */
export function UsdcFundingHost() {
  const { address, chainId } = useConnection();
  const { closeUsdcFunding, isUsdcFundingOpen, openUsdcFunding } = useFundingLaunch();
  if (!address || !isUsdcFundingAvailable(chainId)) return null;
  return (
    <FundWithUsdcDialog
      // Subgraph account ids are lowercase addresses; the dialog uses it to refresh account queries.
      accountId={address.toLowerCase()}
      key={address}
      onOpenChange={(open) => (open ? openUsdcFunding() : closeUsdcFunding())}
      open={isUsdcFundingOpen}
    />
  );
}
