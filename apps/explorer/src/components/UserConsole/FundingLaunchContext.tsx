"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type FundingLaunch = {
  /** Whether the console-wide "Fund with USDC" dialog is open. */
  isUsdcFundingOpen: boolean;
  openUsdcFunding: () => void;
  closeUsdcFunding: () => void;
};

const FundingLaunchContext = createContext<FundingLaunch | null>(null);

/**
 * Holds the open state of the USDC funding dialog for the whole console. The
 * wallet menu, the add-funds picker and the first-time trigger all open the
 * same dialog, which UsdcFundingHost renders exactly once, so a request to
 * fund is never dropped for want of a listener.
 */
export function FundingLaunchProvider({ children }: { children: ReactNode }) {
  const [isUsdcFundingOpen, setUsdcFundingOpen] = useState(false);
  const openUsdcFunding = useCallback(() => setUsdcFundingOpen(true), []);
  const closeUsdcFunding = useCallback(() => setUsdcFundingOpen(false), []);
  const value = useMemo(
    () => ({ isUsdcFundingOpen, openUsdcFunding, closeUsdcFunding }),
    [isUsdcFundingOpen, openUsdcFunding, closeUsdcFunding],
  );
  return <FundingLaunchContext.Provider value={value}>{children}</FundingLaunchContext.Provider>;
}

export function useFundingLaunch(): FundingLaunch {
  const launch = useContext(FundingLaunchContext);
  if (!launch) throw new Error("useFundingLaunch must be used within FundingLaunchProvider");
  return launch;
}
