import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateAccountQueries } from "./query-invalidation";

const OWNER = "0x1111111111111111111111111111111111111111";

describe("invalidateAccountQueries", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invalidates the account's data now and again once the subgraph has caught up", async () => {
    const queryClient = new QueryClient();
    const affected = [
      ["account", OWNER, "mainnet"],
      ["account", OWNER.toLowerCase(), "tokens", 1, 100, "mainnet"],
      ["account", OWNER.toLowerCase(), "approvals", 1, "mainnet"],
      ["payments", "account-summary", 314, OWNER],
      ["balance", { address: OWNER }],
      ["readContract", { functionName: "balanceOf" }],
      ["rail", "7"],
      ["railSettlementAmounts", 314, "7"],
    ] as const;
    const untouched = ["account", "0x2222222222222222222222222222222222222222", "mainnet"] as const;
    for (const queryKey of [...affected, untouched]) queryClient.setQueryData(queryKey, "cached");
    const invalidated = () => affected.map((queryKey) => queryClient.getQueryState(queryKey)?.isInvalidated);

    await invalidateAccountQueries(queryClient, OWNER, { repeatAfterMs: [5_000] });
    expect(invalidated()).toEqual(affected.map(() => true));
    expect(queryClient.getQueryState(untouched)?.isInvalidated).toBe(false);

    for (const queryKey of affected) queryClient.setQueryData(queryKey, "refetched");
    expect(invalidated()).toEqual(affected.map(() => false));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(invalidated()).toEqual(affected.map(() => true));
  });
});
