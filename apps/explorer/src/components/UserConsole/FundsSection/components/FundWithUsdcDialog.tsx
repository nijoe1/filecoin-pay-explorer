"use client";

import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Input } from "@filecoin-foundation/ui-filecoin/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@filecoin-pay/ui/components/dialog";
import { Label } from "@filecoin-pay/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@filecoin-pay/ui/components/select";
import { fetchSourceTokens } from "@filecoin-project/squid-evm-funding";
import { type ConnectedWallet, useConnectWallet, useFundWallet, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { type Address, createWalletClient, custom, erc20Abi, formatUnits, type Hash, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useTopUpActivity } from "@/components/UserConsole/TopUpActivityContext";
import { useTransactionReview } from "@/components/UserConsole/TransactionReview";
import { mainnet, SQUID_SOURCE_CHAINS } from "@/constants/chains";
import { formatAddress } from "@/utils/formatter";
import { formatUsdfcAmount } from "../data/funding-runway";
import { invalidateTopUpQueries } from "../data/guided-top-up";
import {
  awaitSquidDepositSettlement,
  executeSquidDeposit,
  SquidDepositError,
  type SquidDepositResult,
  type SquidDepositStage,
} from "../data/squid-deposit-execution";
import {
  getRequiredNativeBalance,
  getUsdfcPerUsdc,
  isExecutableQuote,
  isUnfavorableRate,
  requestSquidDepositRoute,
  type SquidDepositRouteRequest,
  selectUsdcTokens,
} from "../data/squid-deposit-route";
import {
  clearPendingSquidDeposit,
  loadPendingSquidDeposit,
  type PendingSquidDeposit,
  savePendingSquidDeposit,
} from "../data/squid-deposit-tracker";
import { walletErrorMessage } from "../data/squid-execution";
import { squidFetch } from "../data/squid-quote";

const QUOTE_DEBOUNCE_MS = 500;
// Base has the cheapest gas among the Squid source networks and is where
// Privy's funding flows deliver USDC.
const DEFAULT_SOURCE_CHAIN_ID = 8453;
const APPROVAL_GAS_UNITS = 60_000n;
const DEFAULT_FUND_USDC_AMOUNT = "25";
const MINIMUM_GAS_TOP_UP = "0.002";
// Same public integrator ID the guided top-up falls back to.
const DEFAULT_INTEGRATOR_ID = "filecoin-testing-94a4a25a-d40b-41cb-b148-e96098862";

type UiStage = SquidDepositStage | "preparing";

const STAGE_LABELS: Record<UiStage, string> = {
  preparing: "Preparing the route…",
  approving: "Approving USDC…",
  "swap-requested": "Waiting for the transaction to be signed…",
  "swap-broadcast": "Waiting for the source network to confirm…",
  bridging: "Bridging to Filecoin and depositing… this takes about two minutes.",
  verifying: "Confirming your Filecoin Pay balance…",
};

export function isPrivyEmbeddedWallet(wallet: Pick<ConnectedWallet, "walletClientType">): boolean {
  return wallet.walletClientType === "privy";
}

export function describeWallet(wallet: Pick<ConnectedWallet, "address" | "walletClientType">): string {
  const name = isPrivyEmbeddedWallet(wallet)
    ? "Privy wallet"
    : wallet.walletClientType.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
  return `${name} (${formatAddress(wallet.address)})`;
}

/** Privy reports wallet chains as CAIP-2 ids such as `eip155:8453`. */
export function parseWalletChainId(chainId: string): number | undefined {
  const parsed = Number(chainId.replace(/^eip155:/, ""));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseUsdcAmount(amount: string, decimals: number): bigint | null {
  const trimmed = amount.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function pickDefaultWallet(wallets: readonly ConnectedWallet[]): ConnectedWallet | undefined {
  return wallets.find(isPrivyEmbeddedWallet) ?? wallets[0];
}

type FundWithUsdcDialogProps = {
  accountId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function FundWithUsdcDialog({ accountId, onOpenChange, open }: FundWithUsdcDialogProps) {
  const { address: recipient } = useAccount();
  const { ready: walletsReady, wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const { fundWallet } = useFundWallet();
  const { setTopUpActive } = useTopUpActivity();
  const { requestReview, reviewDialog } = useTransactionReview();
  const queryClient = useQueryClient();
  const amountInputId = useId();

  const [payingAddress, setPayingAddress] = useState("");
  const [sourceChainId, setSourceChainId] = useState(DEFAULT_SOURCE_CHAIN_ID);
  const [sourceTokenAddress, setSourceTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [debouncedAmount] = useDebounce(amount, QUOTE_DEBOUNCE_MS);
  const [stage, setStage] = useState<UiStage | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSquidDeposit | null>(null);
  const switchedEmbeddedWallet = useRef<ConnectedWallet | null>(null);
  const resumedHash = useRef<Hash | null>(null);
  const wasOpen = useRef(false);

  const integratorId = process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID?.trim() || DEFAULT_INTEGRATOR_ID;
  const squid = { integratorId, fetch: squidFetch };
  const depositTarget = { payments: mainnet.contracts.payments.address, usdfc: mainnet.contracts.usdfc.address };

  const payingWallet =
    wallets.find((wallet) => wallet.address.toLowerCase() === payingAddress.toLowerCase()) ??
    pickDefaultWallet(wallets);
  const isEmbedded = payingWallet ? isPrivyEmbeddedWallet(payingWallet) : false;
  const sourceChain = SQUID_SOURCE_CHAINS.find((chain) => chain.id === sourceChainId);
  const nativeSymbol = sourceChain?.nativeCurrency.symbol ?? "gas";
  const sourceClient = usePublicClient({ chainId: sourceChainId });
  const destinationClient = usePublicClient({ chainId: mainnet.id });

  const tokensQuery = useQuery({
    enabled: open,
    queryFn: async () => selectUsdcTokens(await fetchSourceTokens(sourceChainId, squid)),
    queryKey: ["squid-usdc-tokens", sourceChainId, integratorId],
    staleTime: 5 * 60_000,
  });
  const usdcTokens = tokensQuery.data ?? [];
  const sourceToken =
    usdcTokens.find((token) => token.token.toLowerCase() === sourceTokenAddress.toLowerCase()) ?? usdcTokens[0];

  const balancesQuery = useQuery({
    enabled: open && !!sourceClient && !!payingWallet && !!sourceToken,
    queryFn: async () => {
      if (!sourceClient || !payingWallet || !sourceToken) throw new Error("Balances are unavailable");
      const owner = payingWallet.address as Address;
      const [token, native, gasPrice] = await Promise.all([
        sourceClient.readContract({
          abi: erc20Abi,
          address: sourceToken.token,
          args: [owner],
          functionName: "balanceOf",
        }),
        sourceClient.getBalance({ address: owner }),
        sourceClient.getGasPrice(),
      ]);
      return { token, native, gasPrice };
    },
    queryKey: ["squid-deposit-balances", sourceChainId, sourceToken?.token, payingWallet?.address],
    refetchInterval: 15_000,
  });
  const balances = balancesQuery.data;

  const parsedAmount = sourceToken ? parseUsdcAmount(debouncedAmount, sourceToken.decimals) : null;
  const quoteQuery = useQuery({
    enabled: open && stage === null && !!payingWallet && !!sourceToken && !!recipient && parsedAmount !== null,
    queryFn: () => {
      if (!payingWallet || !sourceToken || !recipient || parsedAmount === null) throw new Error("Quote unavailable");
      return requestSquidDepositRoute(
        {
          ...depositTarget,
          owner: payingWallet.address as Address,
          recipient,
          sourceChainId,
          sourceToken: sourceToken.token,
          sourceAmount: parsedAmount,
        },
        squid,
        { quoteOnly: true },
      );
    },
    queryKey: [
      "squid-deposit-quote",
      sourceChainId,
      sourceToken?.token,
      parsedAmount?.toString(),
      payingWallet?.address,
      recipient,
    ],
    retry: false,
    staleTime: 20_000,
  });
  const quote = quoteQuery.data;
  const rate = quote && sourceToken ? getUsdfcPerUsdc(quote, sourceToken.decimals) : null;
  const requiredNative =
    quote && balances ? getRequiredNativeBalance(quote, sourceChainId, APPROVAL_GAS_UNITS * balances.gasPrice) : null;
  const hasInsufficientUsdc = balances !== undefined && parsedAmount !== null && balances.token < parsedAmount;
  const hasInsufficientGas = balances !== undefined && requiredNative !== null && balances.native < requiredNative;
  const isBusy = stage !== null;
  const canConfirm =
    !isBusy &&
    pending === null &&
    !!quote &&
    !!payingWallet &&
    !!sourceToken &&
    !!sourceClient &&
    !!destinationClient &&
    !hasInsufficientUsdc &&
    !hasInsufficientGas;

  // Only an open dialog claims top-up activity; a closed instance elsewhere on
  // the page must not clear it for the guided flow.
  useEffect(() => {
    if (open) setTopUpActive(true);
    else if (wasOpen.current) setTopUpActive(false);
    wasOpen.current = open;
    if (!open) return;
    setAmount("");
    setError(null);
    setStage(null);
    setTransactionHash(null);
    resumedHash.current = null;
    try {
      setPending(recipient ? loadPendingSquidDeposit(window.localStorage, recipient) : null);
    } catch {
      setPending(null);
    }
  }, [open, recipient, setTopUpActive]);

  useEffect(
    () => () => {
      if (wasOpen.current) setTopUpActive(false);
    },
    [setTopUpActive],
  );

  // Reads the latest handlers without making the effect below depend on them.
  const resumeOnOpen = useEffectEvent((pendingDeposit: PendingSquidDeposit) => {
    if (isBusy || resumedHash.current === pendingDeposit.transactionHash) return;
    resumedHash.current = pendingDeposit.transactionHash;
    void resumePendingDeposit(pendingDeposit);
  });

  useEffect(() => {
    if (open && pending) resumeOnOpen(pending);
  }, [open, pending]);

  const setStageWithHash = (nextStage: SquidDepositStage, hash?: Hash) => {
    setStage(nextStage);
    if (hash) setTransactionHash(hash);
  };

  const restoreEmbeddedChain = () => {
    const wallet = switchedEmbeddedWallet.current;
    switchedEmbeddedWallet.current = null;
    if (!wallet) return;
    void wallet.switchChain(mainnet.id).catch((switchError: unknown) => {
      toast.error("Could not switch your Privy wallet back to Filecoin", {
        description: walletErrorMessage(switchError, "Switch networks from the wallet menu."),
      });
    });
  };

  const closeDialog = () => {
    restoreEmbeddedChain();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) {
      toast.info("Wait for the current step to finish before closing this dialog.");
      return;
    }
    if (nextOpen) onOpenChange(true);
    else closeDialog();
  };

  const finishDeposit = async (result: SquidDepositResult, depositRecipient: Address) => {
    try {
      clearPendingSquidDeposit(window.localStorage, depositRecipient);
    } catch {
      // Storage is best effort; the deposit itself is confirmed on-chain.
    }
    setPending(null);
    setStage(null);
    toast.success(`Deposited ${formatUsdfcAmount(result.depositedAmount)} USDFC into Filecoin Pay`);
    await invalidateTopUpQueries(queryClient, accountId, depositRecipient);
    closeDialog();
  };

  const handleFailure = (failure: unknown, depositRecipient: Address | undefined) => {
    setStage(null);
    if (failure instanceof SquidDepositError) {
      setError(failure.message);
      if (failure.reason !== "timeout" && depositRecipient) {
        // Nothing is left to resume: the route failed or delivered to the wallet.
        try {
          clearPendingSquidDeposit(window.localStorage, depositRecipient);
        } catch {
          // Storage is best effort.
        }
        setPending(null);
      }
      return;
    }
    setError(walletErrorMessage(failure, "The USDC funding could not be completed."));
  };

  const resumePendingDeposit = async (pendingDeposit: PendingSquidDeposit) => {
    if (!destinationClient) return;
    setError(null);
    setTransactionHash(pendingDeposit.transactionHash);
    try {
      const result = await awaitSquidDepositSettlement({
        destinationClient,
        fundsBefore: pendingDeposit.fundsBefore,
        onStage: setStageWithHash,
        quoteId: pendingDeposit.quoteId,
        sourceChainId: pendingDeposit.sourceChainId,
        squid,
        target: { ...depositTarget, recipient: pendingDeposit.recipient },
        transactionHash: pendingDeposit.transactionHash,
      });
      await finishDeposit(result, pendingDeposit.recipient);
    } catch (failure) {
      handleFailure(failure, pendingDeposit.recipient);
    }
  };

  const dismissPendingDeposit = () => {
    if (!pending) return;
    if (!window.confirm("Only dismiss this after checking the transaction on the source network explorer.")) return;
    try {
      clearPendingSquidDeposit(window.localStorage, pending.recipient);
    } catch {
      // Storage is best effort.
    }
    setPending(null);
    setError(null);
    setTransactionHash(null);
  };

  const handleConfirm = async () => {
    if (!canConfirm || !payingWallet || !sourceToken || !sourceChain || !recipient || parsedAmount === null || !quote) {
      return;
    }
    if (!sourceClient || !destinationClient) return;
    setError(null);
    const owner = payingWallet.address as Address;
    const request: SquidDepositRouteRequest = {
      ...depositTarget,
      owner,
      recipient,
      sourceChainId,
      sourceToken: sourceToken.token,
      sourceAmount: parsedAmount,
    };
    if (isEmbedded) {
      const confirmed = await requestReview({
        title: `Fund with ${amount} ${sourceToken.symbol}`,
        rows: [
          { label: "Pay from", value: owner },
          { label: "Network", value: sourceChain.name },
          { label: "Receive at least", value: `${formatUsdfcAmount(quote.minimumDestinationAmount)} USDFC` },
          { label: "Deposit to", value: `Filecoin Pay account ${recipient}` },
        ],
        details: JSON.stringify(
          { quoteId: quote.quoteId, router: "Squid", sourceToken: sourceToken.token, recipient },
          null,
          2,
        ),
      });
      if (!confirmed) return;
    }

    setStage("preparing");
    try {
      await payingWallet.switchChain(sourceChainId);
      if (isEmbedded) switchedEmbeddedWallet.current = payingWallet;
      const provider = await payingWallet.getEthereumProvider();
      const walletClient = createWalletClient({ account: owner, chain: sourceChain, transport: custom(provider) });
      const executable = await requestSquidDepositRoute(request, squid, { quoteOnly: false });
      if (!isExecutableQuote(executable)) throw new Error("Squid did not return an executable route");
      if (executable.minimumDestinationAmount < (quote.minimumDestinationAmount * 99n) / 100n) {
        throw new Error("The executable quote fell more than 1% below the reviewed amount. Refresh and try again.");
      }
      const result = await executeSquidDeposit({
        destinationClient,
        onBroadcast: ({ transactionHash: hash, fundsBefore }) => {
          const pendingDeposit: PendingSquidDeposit = {
            recipient,
            owner,
            sourceChainId,
            quoteId: executable.quoteId,
            transactionHash: hash,
            sourceAmount: parsedAmount,
            minimumDestinationAmount: executable.minimumDestinationAmount,
            fundsBefore,
            startedAt: Date.now(),
          };
          resumedHash.current = hash;
          try {
            setPending(savePendingSquidDeposit(window.localStorage, pendingDeposit));
          } catch {
            setPending(pendingDeposit);
          }
        },
        onStage: setStageWithHash,
        quote: executable,
        request,
        sourceClient,
        squid,
        walletClient,
      });
      await finishDeposit(result, recipient);
    } catch (failure) {
      handleFailure(failure, recipient);
    }
  };

  const fundEmbeddedWallet = async (asset: "USDC" | "native-currency", fundAmount: string) => {
    if (!payingWallet || !sourceChain) return;
    try {
      await fundWallet({ address: payingWallet.address, options: { chain: sourceChain, asset, amount: fundAmount } });
    } catch (fundError) {
      toast.error("Privy funding was not completed", {
        description: fundError instanceof Error ? fundError.message : undefined,
      });
    } finally {
      void balancesQuery.refetch();
    }
  };

  const gasShortfall =
    balances !== undefined && requiredNative !== null && requiredNative > balances.native
      ? requiredNative - balances.native
      : 0n;
  const gasTopUpAmount = (() => {
    const shortfall = Number(formatUnits(gasShortfall, 18));
    return Math.max(shortfall * 2, Number(MINIMUM_GAS_TOP_UP)).toFixed(4);
  })();
  const explorerUrl = sourceChain?.blockExplorers?.default.url;
  const activeStage = stage ?? (pending ? "bridging" : null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>Fund with USDC</DialogTitle>
          <DialogDescription>
            USDC is swapped to USDFC through{" "}
            <a
              className='underline underline-offset-2'
              href='https://app.squidrouter.com/'
              rel='noopener noreferrer'
              target='_blank'
            >
              Squid
            </a>{" "}
            and deposited into your Filecoin Pay account in one transaction. Nothing needs to be done on Filecoin.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 text-sm'>
          <div className='grid gap-1'>
            <span className='text-muted-foreground'>Deposit to</span>
            <span className='font-mono break-all'>
              {recipient ? `Filecoin Pay account ${recipient}` : "Connect a wallet"}
            </span>
          </div>

          {pending ? (
            <div className='grid gap-2 rounded-md border p-3' role='status'>
              <p className='font-medium'>Deposit in progress</p>
              <p className='text-muted-foreground'>
                {activeStage ? STAGE_LABELS[activeStage] : "Waiting for the route to settle…"}
              </p>
              <TransactionLink explorerUrl={explorerUrl} hash={pending.transactionHash} />
              {error && (
                <p className='text-destructive' role='alert'>
                  {error}
                </p>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  aria-label='Check deposit again'
                  disabled={isBusy}
                  onClick={() => void resumePendingDeposit(pending)}
                  size='compact'
                  type='button'
                  variant='tertiary'
                >
                  Check again
                </Button>
                <Button
                  aria-label='Dismiss pending deposit'
                  disabled={isBusy}
                  onClick={dismissPendingDeposit}
                  size='compact'
                  type='button'
                  variant='ghost'
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className='grid gap-2'>
                <Label htmlFor='fund-with-usdc-wallet'>Pay from</Label>
                <Select
                  disabled={isBusy || !walletsReady || wallets.length === 0}
                  onValueChange={setPayingAddress}
                  value={payingWallet?.address ?? ""}
                >
                  <SelectTrigger aria-label='Paying wallet' id='fund-with-usdc-wallet'>
                    <SelectValue placeholder={walletsReady ? "Choose a wallet" : "Loading wallets…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.address} value={wallet.address}>
                        {describeWallet(wallet)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Button
                    aria-label='Connect another wallet'
                    disabled={isBusy}
                    onClick={() => connectWallet()}
                    size='compact'
                    type='button'
                    variant='tertiary'
                  >
                    Connect another wallet
                  </Button>
                </div>
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='fund-with-usdc-network'>Pay on</Label>
                <Select
                  disabled={isBusy}
                  onValueChange={(value) => {
                    setSourceChainId(Number(value));
                    setSourceTokenAddress("");
                  }}
                  value={String(sourceChainId)}
                >
                  <SelectTrigger aria-label='Source network' id='fund-with-usdc-network'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SQUID_SOURCE_CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={String(chain.id)}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {usdcTokens.length > 1 && (
                <div className='grid gap-2'>
                  <Label htmlFor='fund-with-usdc-token'>USDC token</Label>
                  <Select disabled={isBusy} onValueChange={setSourceTokenAddress} value={sourceToken?.token ?? ""}>
                    <SelectTrigger aria-label='USDC token' id='fund-with-usdc-token'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {usdcTokens.map((token) => (
                        <SelectItem key={token.token} value={token.token}>
                          {token.symbol} ({formatAddress(token.token)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {tokensQuery.isError && (
                <p className='text-destructive' role='alert'>
                  Could not load Squid's token list. Try again shortly.
                </p>
              )}
              {!tokensQuery.isPending && !tokensQuery.isError && usdcTokens.length === 0 && (
                <p className='text-muted-foreground'>Squid lists no USDC on {sourceChain?.name ?? "this network"}.</p>
              )}

              <div className='grid gap-2'>
                <div className='flex items-center justify-between gap-2'>
                  <Label htmlFor={amountInputId}>Amount ({sourceToken?.symbol ?? "USDC"})</Label>
                  {balances && sourceToken && (
                    <button
                      className='text-xs text-muted-foreground underline underline-offset-2'
                      disabled={isBusy}
                      onClick={() => setAmount(formatUnits(balances.token, sourceToken.decimals))}
                      type='button'
                    >
                      Balance: {formatUnits(balances.token, sourceToken.decimals)} (max)
                    </button>
                  )}
                </div>
                <Input
                  disabled={isBusy || !sourceToken}
                  id={amountInputId}
                  min='0'
                  onChange={setAmount}
                  step='any'
                  type='number'
                  value={amount}
                />
                {amount !== "" && parsedAmount === null && debouncedAmount === amount && (
                  <p className='text-destructive'>Enter an amount greater than zero.</p>
                )}
                {hasInsufficientUsdc && (
                  <p className='text-destructive' role='alert'>
                    Not enough {sourceToken?.symbol ?? "USDC"} in this wallet.
                  </p>
                )}
                {isEmbedded && sourceChain && (
                  <div>
                    <Button
                      aria-label='Add USDC with Privy'
                      disabled={isBusy}
                      onClick={() =>
                        void fundEmbeddedWallet("USDC", parsedAmount === null ? DEFAULT_FUND_USDC_AMOUNT : amount)
                      }
                      size='compact'
                      type='button'
                      variant='tertiary'
                    >
                      Add USDC to your Privy wallet
                    </Button>
                  </div>
                )}
              </div>

              {quoteQuery.isFetching && !quote && (
                <p className='inline-flex items-center gap-2 text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin' /> Fetching a quote…
                </p>
              )}
              {quoteQuery.error && (
                <p className='text-destructive' role='alert'>
                  {quoteQuery.error instanceof Error ? quoteQuery.error.message : "Squid could not quote this amount."}
                </p>
              )}
              {quote && sourceToken && rate !== null && (
                <div className='grid gap-1 rounded-md border p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-muted-foreground'>You receive at least</span>
                    <span className='font-medium'>{formatUsdfcAmount(quote.minimumDestinationAmount)} USDFC</span>
                  </div>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-muted-foreground'>Rate</span>
                    <span>
                      1 {sourceToken.symbol} ≈ {rate.toFixed(4)} USDFC
                      {quote.priceImpactPercent ? ` (price impact ${quote.priceImpactPercent}%)` : ""}
                    </span>
                  </div>
                  {quote.fees.length > 0 && (
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-muted-foreground'>Route fees</span>
                      <span>
                        {quote.fees.map((fee) => `${fee.name}${fee.amountUsd ? ` $${fee.amountUsd}` : ""}`).join(", ")}
                      </span>
                    </div>
                  )}
                  {quote.estimatedSeconds !== undefined && (
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-muted-foreground'>Estimated time</span>
                      <span>about {Math.max(1, Math.round(quote.estimatedSeconds / 60))} min</span>
                    </div>
                  )}
                  {isUnfavorableRate(rate) && (
                    <p className='mt-1 inline-flex items-start gap-2 text-amber-700'>
                      <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                      <span>
                        This route returns noticeably less than 1 USDFC per {sourceToken.symbol}. Only continue if the
                        rate is acceptable.
                      </span>
                    </p>
                  )}
                </div>
              )}

              {hasInsufficientGas && sourceChain && (
                <div className='grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800'>
                  <p>
                    This wallet needs about {formatUnits(requiredNative ?? 0n, 18)} {nativeSymbol} on {sourceChain.name}{" "}
                    for gas and route fees.
                  </p>
                  {isEmbedded && (
                    <div>
                      <Button
                        aria-label='Add gas with Privy'
                        disabled={isBusy}
                        onClick={() => void fundEmbeddedWallet("native-currency", gasTopUpAmount)}
                        size='compact'
                        type='button'
                        variant='tertiary'
                      >
                        Add {gasTopUpAmount} {nativeSymbol} with Privy
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {stage && (
                <div className='grid gap-1 rounded-md border p-3' role='status'>
                  <p className='inline-flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    {stage === "swap-requested" && isEmbedded ? "Signing with your Privy wallet…" : STAGE_LABELS[stage]}
                  </p>
                  {transactionHash && <TransactionLink explorerUrl={explorerUrl} hash={transactionHash} />}
                </div>
              )}
              {error && (
                <p className='text-destructive' role='alert'>
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button disabled={isBusy} onClick={() => handleOpenChange(false)} type='button' variant='ghost'>
            {pending ? "Close" : "Cancel"}
          </Button>
          {!pending && (
            <Button
              aria-label='Fund with USDC'
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
              type='button'
              variant='primary'
            >
              {isBusy ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Funding…
                </span>
              ) : (
                "Fund with USDC"
              )}
            </Button>
          )}
        </DialogFooter>
        {reviewDialog}
      </DialogContent>
    </Dialog>
  );
}

function TransactionLink({ explorerUrl, hash }: { explorerUrl?: string; hash: Hash }) {
  if (!explorerUrl) return <code className='block break-all text-xs'>{hash}</code>;
  return (
    <a
      className='block break-all text-xs underline underline-offset-2'
      href={`${explorerUrl}/tx/${hash}`}
      rel='noopener noreferrer'
      target='_blank'
    >
      {hash}
    </a>
  );
}
