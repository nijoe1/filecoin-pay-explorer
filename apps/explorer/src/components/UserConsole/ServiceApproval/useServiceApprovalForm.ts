import { useEffect, useState } from "react";
import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";
import { daysToEpochs } from "@/utils/lockup-period";
import {
  describeAllowance,
  knownTokenDetails,
  resolveServiceAddress,
  resolveTokenAddress,
  type ServiceSuggestion,
  type TokenDetails,
  type TokenSuggestion,
  toAllowanceWei,
} from "./service-approval-form";

export type TokenStatus = "empty" | "invalid" | "loading" | "error" | "loaded";

/**
 * Everything a service approval asks for: the service, the token, the two
 * allowances and the longest lockup. Dialogs render the fields in the order
 * they like and read the resolved values back from here.
 */
export function useServiceApprovalForm({
  open,
  services = [],
  tokens = [],
}: {
  open: boolean;
  services?: readonly ServiceSuggestion[];
  tokens?: readonly TokenSuggestion[];
}) {
  const [serviceInput, setServiceInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [lockupAllowance, setLockupAllowance] = useState("");
  const [rateAllowance, setRateAllowance] = useState("");
  const [maxLockupPeriod, setMaxLockupPeriod] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(false);

  useEffect(() => {
    if (open) return;
    setServiceInput("");
    setTokenInput("");
    setLockupAllowance("");
    setRateAllowance("");
    setMaxLockupPeriod("");
    setIsUnlimited(false);
  }, [open]);

  const serviceAddress = resolveServiceAddress(serviceInput, services);
  const tokenAddress = resolveTokenAddress(tokenInput, tokens);
  const known = knownTokenDetails(tokens, tokenAddress);
  const shouldReadToken = open && !!tokenAddress && !known;
  const tokenRead = useReadContracts({
    contracts:
      tokenAddress && shouldReadToken
        ? [
            { abi: erc20Abi, address: tokenAddress, functionName: "symbol" },
            { abi: erc20Abi, address: tokenAddress, functionName: "decimals" },
            { abi: erc20Abi, address: tokenAddress, functionName: "name" },
          ]
        : [],
    query: { enabled: shouldReadToken },
  });
  const read = tokenRead.data;
  const fetched: TokenDetails | null =
    shouldReadToken && read && !tokenRead.isError
      ? {
          decimals: Number(read[1]?.result ?? 0),
          name: (read[2]?.result as string | undefined) ?? "",
          symbol: (read[0]?.result as string | undefined) ?? "",
        }
      : null;
  const tokenDetails = known ?? fetched;
  const tokenStatus: TokenStatus =
    tokenInput.trim() === ""
      ? "empty"
      : !tokenAddress
        ? "invalid"
        : tokenDetails
          ? "loaded"
          : tokenRead.isError
            ? "error"
            : "loading";

  const maxLockupEpochs = daysToEpochs(maxLockupPeriod);
  const isComplete = !!serviceAddress && !!tokenAddress && tokenStatus === "loaded" && maxLockupEpochs !== null;
  const decimals = tokenDetails?.decimals ?? 0;

  return {
    fields: {
      isUnlimited,
      lockupAllowance,
      maxLockupPeriod,
      rateAllowance,
      serviceInput,
      setIsUnlimited,
      setLockupAllowance,
      setMaxLockupPeriod,
      setRateAllowance,
      setServiceInput,
      setTokenInput,
      tokenInput,
    },
    isComplete,
    lockupAllowanceWei: toAllowanceWei(lockupAllowance, decimals, isUnlimited),
    maxLockupEpochs,
    rateAllowanceWei: toAllowanceWei(rateAllowance, decimals, isUnlimited),
    /** What the review sheet shows for the limits. */
    review: {
      lockupAllowance: describeAllowance(lockupAllowance, isUnlimited),
      maxLockupPeriod: `${maxLockupPeriod.trim()} days`,
      rateAllowance: describeAllowance(rateAllowance, isUnlimited),
    },
    serviceAddress,
    services,
    tokenAddress,
    tokenDetails,
    tokenStatus,
    tokens,
  };
}

export type ServiceApprovalForm = ReturnType<typeof useServiceApprovalForm>;
