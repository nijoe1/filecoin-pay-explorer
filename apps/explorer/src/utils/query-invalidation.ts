import type { QueryClient } from "@tanstack/react-query";

/**
 * Subgraph-backed queries lag the chain by a block or two, so one pass right
 * after the receipt often re-reads the stale index; a couple of later passes
 * catch up once the indexer has seen the block.
 */
export const ACCOUNT_REFRESH_DELAYS_MS: readonly number[] = [10_000, 30_000];

/** Query-key prefixes that any on-chain change to a console account can move. */
export function accountQueryPrefixes(address: string): readonly (readonly unknown[])[] {
  const ids = [...new Set([address, address.toLowerCase()])];
  return [
    ...ids.map((id) => ["account", id] as const),
    ["payments", "account-summary"],
    ["balance"],
    ["readContract"],
    ["rail"],
    ["rails"],
    ["railSettlementAmounts"],
    ["direct-squid-destination-fil"],
    ["direct-squid-deposit-balances"],
    ["squid", "source-token-balances"],
  ];
}

function invalidateOnce(queryClient: QueryClient, address: string) {
  return Promise.all(accountQueryPrefixes(address).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/**
 * Refreshes everything the console shows for `address` after a confirmed
 * mutation: the immediate pass is awaited, the delayed passes run on their
 * own so the caller can move on.
 */
export function invalidateAccountQueries(
  queryClient: QueryClient,
  address: string,
  { repeatAfterMs = ACCOUNT_REFRESH_DELAYS_MS }: { repeatAfterMs?: readonly number[] } = {},
) {
  for (const delay of repeatAfterMs) {
    setTimeout(() => void invalidateOnce(queryClient, address).catch(() => undefined), delay);
  }
  return invalidateOnce(queryClient, address);
}
