"use client";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import SessionKeysSection from "@/components/UserConsole/SessionKeysSection";
import { useConsumedSearchParams } from "@/hooks/useConsumedSearchParams";
import { parseAuthorizeParam, parseNetworkParam, parseScopesParam } from "@/utils/authorizeParam";
import { getNetworkFromChainId } from "@/utils/network";

const SessionKeysPage = () => {
  const { address, chainId } = useConnection();
  const link = useConsumedSearchParams(["authorize", "scopes", "network"]);
  const request = useMemo(() => {
    const requested = link ? parseAuthorizeParam(link.get("authorize")) : null;
    if (!link || !requested) return null;
    // Scopes and network only mean something as part of a usable request.
    if ("address" in requested) {
      return {
        address: requested.address,
        scopes: parseScopesParam(link.get("scopes")),
        network: parseNetworkParam(link.get("network")),
        error: null,
      };
    }
    return { address: null, scopes: null, network: null, error: requested.error };
  }, [link]);

  return (
    <SessionKeysSection
      network={getNetworkFromChainId(chainId)}
      account={address}
      prefillAddress={request?.address}
      prefillScopes={request?.scopes}
      prefillNetwork={request?.network}
      prefillError={request?.error}
    />
  );
};

export default SessionKeysPage;
