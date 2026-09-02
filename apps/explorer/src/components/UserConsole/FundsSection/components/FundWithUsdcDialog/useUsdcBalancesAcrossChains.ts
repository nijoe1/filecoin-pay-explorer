import { useQueries, useQueryClient } from "@tanstack/react-query";
import { type Address, getAddress } from "viem";
import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { SQUID_SOURCE_CHAINS } from "@/constants/chains";
import type { SquidClient } from "../../data/squid-deposit-route";
import { usdcTokensQueryOptions } from "../../data/squid-usdc-tokens";
import { type BalanceReader, rankUsdcSources, readUsdcSources, type UsdcSource } from "../../data/usdc-sources";

type ScanChainId = (typeof SQUID_SOURCE_CHAINS)[number]["id"];

/** One network's part of the scan: Squid's USDC list, then one multicall for the balances. */
export function buildUsdcSourceQuery({
  chainId,
  getClient,
  loadTokens,
  owner,
}: {
  chainId: number;
  getClient: (chainId: number) => BalanceReader | undefined;
  loadTokens: (chainId: number) => Promise<UsdcSource["token"][]>;
  owner: Address | undefined;
}) {
  return {
    queryFn: async (): Promise<UsdcSource[]> => {
      if (!owner) throw new Error("No wallet to scan");
      const tokens = await loadTokens(chainId);
      const client = getClient(chainId);
      if (!client) throw new Error(`No RPC client for chain ${chainId}`);
      return readUsdcSources({ chainId, client, owner, tokens });
    },
    queryKey: ["squid-usdc-sources", chainId, owner],
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 15_000,
  };
}

/**
 * Where the paying wallet's USDC actually is: every Squid source network is
 * scanned at once, and the result comes back largest balance first.
 */
export function useUsdcBalancesAcrossChains({
  enabled,
  owner,
  squid,
}: {
  enabled: boolean;
  owner: string | undefined;
  squid: SquidClient;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const checksummedOwner = owner ? getAddress(owner) : undefined;
  const isEnabled = enabled && !!checksummedOwner;
  const results = useQueries({
    queries: SQUID_SOURCE_CHAINS.map((chain) => ({
      ...buildUsdcSourceQuery({
        chainId: chain.id,
        getClient: (chainId) => getPublicClient(config, { chainId: chainId as ScanChainId }),
        loadTokens: (chainId) => queryClient.fetchQuery(usdcTokensQueryOptions(chainId, squid)),
        owner: checksummedOwner,
      }),
      enabled: isEnabled,
    })),
  });
  return {
    /** True while any network has not answered yet. */
    isPending: isEnabled && results.some((result) => result.isPending),
    refetch: () => Promise.all(results.map((result) => result.refetch())),
    sources: rankUsdcSources(results.flatMap((result) => result.data ?? [])),
  };
}
