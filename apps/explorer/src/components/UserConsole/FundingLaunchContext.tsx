"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

type FundingLaunch = {
  /** Increments each time something asks the console to open USDC funding. */
  usdcLaunchCount: number;
  launchUsdcFunding: () => void;
};

const FundingLaunchContext = createContext<FundingLaunch | null>(null);

/**
 * Lets console chrome such as the wallet menu open the USDC funding dialog
 * that lives inside the funds section, without threading callbacks through
 * every layer in between.
 */
export function FundingLaunchProvider({ children }: { children: ReactNode }) {
  const [usdcLaunchCount, setUsdcLaunchCount] = useState(0);
  const launchUsdcFunding = useCallback(() => setUsdcLaunchCount((count) => count + 1), []);
  const value = useMemo(() => ({ usdcLaunchCount, launchUsdcFunding }), [usdcLaunchCount, launchUsdcFunding]);
  return <FundingLaunchContext.Provider value={value}>{children}</FundingLaunchContext.Provider>;
}

export function useFundingLaunch(): FundingLaunch {
  const launch = useContext(FundingLaunchContext);
  if (!launch) throw new Error("useFundingLaunch must be used within FundingLaunchProvider");
  return launch;
}

/** Runs `onLaunch` for every launch requested after mount. No-op outside the provider. */
export function useUsdcFundingLaunch(onLaunch: () => void) {
  const launch = useContext(FundingLaunchContext);
  const count = launch?.usdcLaunchCount ?? 0;
  const seen = useRef(count);
  const handleLaunch = useEffectEvent(onLaunch);
  useEffect(() => {
    if (count === seen.current) return;
    seen.current = count;
    handleLaunch();
  }, [count]);
}
