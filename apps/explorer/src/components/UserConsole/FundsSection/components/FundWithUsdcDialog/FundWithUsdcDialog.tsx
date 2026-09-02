"use client";

import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Input } from "@filecoin-foundation/ui-filecoin/Input";
import { ExternalTextLink } from "@filecoin-foundation/ui-filecoin/TextLink/ExternalTextLink";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@filecoin-pay/ui/components/dialog";
import { Label } from "@filecoin-pay/ui/components/label";
import {
  useAddFunds,
  useConnectWallet,
  useFiatOnramp,
  useFundWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { isPrivyEmbeddedWallet } from "@/components/UserConsole/console-wallet";
import {
  BASE_CHAIN_ID,
  buildCardOnrampOptions,
  readOnrampEnvironment,
  runPrivyFunding,
  toCaipChainId,
} from "@/components/UserConsole/privy-funding";
import { useTopUpActivity } from "@/components/UserConsole/TopUpActivityContext";
import { useTransactionReview } from "@/components/UserConsole/TransactionReview";
import { mainnet, SQUID_SOURCE_CHAINS } from "@/constants/chains";
import { formatAddress } from "@/utils/formatter";
import { createDialogCloseGuard } from "../../data/dialog-close-guard";
import { readSquidIntegratorId } from "../../data/squid-integrator";
import { squidFetch } from "../../data/squid-quote";
import { PaymentSourceFields } from "./PaymentSourceFields";
import { PendingDepositPanel } from "./PendingDepositPanel";
import { GasShortfallPanel, TopUpWalletPanel } from "./PrivyFundingPanels";
import { QuoteSummary } from "./QuoteSummary";
import { describeStage } from "./stages";
import { TransactionLink } from "./TransactionLink";
import { useSquidDepositExecution } from "./useSquidDepositExecution";
import { useSquidDepositQuote } from "./useSquidDepositQuote";
import { formatTokenAmount, pickDefaultWallet } from "./wallets";

const QUOTE_DEBOUNCE_MS = 500;
// Base has the cheapest gas among the Squid source networks and is where
// Privy's funding flows deliver USDC.
const DEFAULT_SOURCE_CHAIN_ID = BASE_CHAIN_ID;
const DEPOSIT_CONTRACTS = { payments: mainnet.contracts.payments.address, usdfc: mainnet.contracts.usdfc.address };

type FundWithUsdcDialogProps = {
  accountId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * Pays USDC from any connected wallet and lands it as USDFC in the Filecoin
 * Pay account. This component owns what the user is choosing (wallet,
 * network, token, amount) and the Privy top-up flows; the quote hook owns what
 * that choice costs and the execution hook owns what happens after confirm.
 */
export function FundWithUsdcDialog({ accountId, onOpenChange, open }: FundWithUsdcDialogProps) {
  const { address: recipient } = useAccount();
  const { ready: areWalletsReady, wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const { addFunds } = useAddFunds();
  const { fund: fundWithCard } = useFiatOnramp();
  // Every Privy funding flow (card, transfer picker, gas) needs a Privy session,
  // so a connect-only wallet is asked to log in first.
  const { authenticated: hasPrivyLogin, login } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { setTopUpActive } = useTopUpActivity();
  const { requestReview, reviewDialog } = useTransactionReview();
  const amountInputId = useId();

  const [payingAddress, setPayingAddress] = useState("");
  const [sourceChainId, setSourceChainId] = useState(DEFAULT_SOURCE_CHAIN_ID);
  const [sourceTokenAddress, setSourceTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [debouncedAmount] = useDebounce(amount, QUOTE_DEBOUNCE_MS);
  const [isFunding, setIsFunding] = useState(false);
  const wasOpen = useRef(false);

  const squid = { integratorId: readSquidIntegratorId(), fetch: squidFetch };
  const payingWallet =
    wallets.find((wallet) => wallet.address.toLowerCase() === payingAddress.toLowerCase()) ??
    pickDefaultWallet(wallets);
  const isEmbedded = payingWallet ? isPrivyEmbeddedWallet(payingWallet) : false;
  const sourceChain = SQUID_SOURCE_CHAINS.find((chain) => chain.id === sourceChainId);
  const nativeSymbol = sourceChain?.nativeCurrency.symbol ?? "gas";
  const sourceClient = usePublicClient({ chainId: sourceChainId });
  const destinationClient = usePublicClient({ chainId: mainnet.id });

  const execution = useSquidDepositExecution({
    accountId,
    depositTarget: DEPOSIT_CONTRACTS,
    destinationClient,
    isEmbedded,
    onClosed: () => onOpenChange(false),
    open,
    recipient,
    requestReview,
    sourceClient,
    squid,
  });
  const {
    balances,
    balancesQuery,
    gasTopUpAmount,
    hasInsufficientGas,
    hasInsufficientUsdc,
    parsedAmount,
    quote,
    quoteQuery,
    rate,
    requiredNative,
    sourceToken,
    tokensQuery,
    usdcTokens,
  } = useSquidDepositQuote({
    amount: debouncedAmount,
    depositTarget: DEPOSIT_CONTRACTS,
    isQuoting: !execution.isExecuting,
    open,
    payingWallet,
    recipient,
    sourceChainId,
    sourceClient,
    sourceTokenAddress,
    squid,
  });
  const { pendingDeposit, stage } = execution;
  const isBusy = execution.isExecuting || isFunding;
  const canConfirm =
    !isBusy &&
    pendingDeposit === null &&
    !!quote &&
    !!payingWallet &&
    !!sourceToken &&
    !!sourceChain &&
    !!recipient &&
    parsedAmount !== null &&
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
    if (open) setAmount("");
  }, [open, setTopUpActive]);

  useEffect(
    () => () => {
      if (wasOpen.current) setTopUpActive(false);
    },
    [setTopUpActive],
  );

  const handleOpenChange = createDialogCloseGuard({
    blockReason: () => (isBusy ? "Wait for the current step to finish before closing this dialog." : null),
    onClose: execution.closeDialog,
    onOpen: () => onOpenChange(true),
  });

  const handleConfirm = () => {
    if (!canConfirm || !payingWallet || !sourceToken || !sourceChain || !recipient || parsedAmount === null || !quote) {
      return;
    }
    return execution.confirm({ amount, parsedAmount, payingWallet, quote, recipient, sourceChain, sourceToken });
  };

  const runFundingFlow = async (
    flow: () => Promise<unknown>,
    { successMessage, unavailableTitle }: { successMessage?: string; unavailableTitle: string },
  ) => {
    setIsFunding(true);
    try {
      if ((await runPrivyFunding(flow, { unavailableTitle })) && successMessage) toast.success(successMessage);
    } finally {
      setIsFunding(false);
      void balancesQuery.refetch();
    }
  };

  /** Privy's card onramp (Stripe, MoonPay, or Meld by region) into the paying wallet. */
  const buyUsdcWithCard = () => {
    if (!payingWallet || !sourceToken) return;
    return runFundingFlow(
      () =>
        fundWithCard(
          buildCardOnrampOptions({
            address: payingWallet.address,
            asset: sourceToken.token,
            chainId: sourceChainId,
            defaultAmount: parsedAmount === null ? undefined : amount,
            environment: readOnrampEnvironment(),
          }),
        ),
      { successMessage: "USDC is on its way to your Privy wallet", unavailableTitle: "Card purchases are unavailable" },
    );
  };

  /** Privy's unified funding modal: exchange or a transfer from another wallet. Needs a Privy login. */
  const transferUsdcToPrivyWallet = () => {
    if (!payingWallet || !sourceToken) return;
    return runFundingFlow(
      () =>
        addFunds({
          destination: { address: payingWallet.address, chain: toCaipChainId(sourceChainId), asset: sourceToken.token },
          crypto: {},
        }),
      { successMessage: "USDC is on its way to your Privy wallet", unavailableTitle: "Privy funding is unavailable" },
    );
  };

  const addGasToPrivyWallet = () => {
    if (!payingWallet || !sourceChain) return;
    return runFundingFlow(
      () =>
        fundWallet({
          address: payingWallet.address,
          options: { chain: sourceChain, asset: "native-currency", amount: gasTopUpAmount },
        }),
      { unavailableTitle: "Privy funding is unavailable" },
    );
  };

  const explorerUrl = sourceChain?.blockExplorers?.default.url;
  const activeStage = stage ?? (pendingDeposit ? "bridging" : null);
  const showEmptyWalletHint = balances !== undefined && balances.token === 0n && parsedAmount === null && !isBusy;
  const payerLabel = isEmbedded ? "your Privy wallet" : "this wallet";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>Fund with USDC</DialogTitle>
          <DialogDescription>
            Pay USDC from any connected wallet. It is swapped to USDFC via{" "}
            <ExternalTextLink href='https://app.squidrouter.com/'>Squid</ExternalTextLink> and deposited into your
            account. Nothing to sign on Filecoin, no FIL needed.
            {recipient ? (
              <span className='mt-1 block font-mono text-xs'>Account {formatAddress(recipient)}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 text-sm'>
          {pendingDeposit ? (
            <PendingDepositPanel
              activeStage={activeStage}
              error={execution.error}
              explorerUrl={explorerUrl}
              hasApproved={execution.hasApproved}
              isBusy={isBusy}
              isEmbedded={isEmbedded}
              onCheckAgain={() => void execution.resumePendingDeposit(pendingDeposit)}
              onDismiss={execution.dismissPendingDeposit}
              pendingDeposit={pendingDeposit}
            />
          ) : (
            <>
              <PaymentSourceFields
                areWalletsReady={areWalletsReady}
                isBusy={isBusy}
                onConnectAnother={() => connectWallet()}
                onPayingAddressChange={setPayingAddress}
                onSourceChainChange={(chainId) => {
                  setSourceChainId(chainId);
                  setSourceTokenAddress("");
                }}
                onSourceTokenChange={setSourceTokenAddress}
                payingWallet={payingWallet}
                sourceChain={sourceChain}
                sourceChainId={sourceChainId}
                sourceToken={sourceToken}
                tokensQuery={tokensQuery}
                usdcTokens={usdcTokens}
                wallets={wallets}
              />

              <div className='grid gap-2'>
                <div className='flex items-center justify-between gap-2'>
                  <Label htmlFor={amountInputId}>Amount ({sourceToken?.symbol ?? "USDC"})</Label>
                  {balances && sourceToken && (
                    <Button
                      disabled={isBusy || balances.token === 0n}
                      onClick={() => setAmount(formatUnits(balances.token, sourceToken.decimals))}
                      size='compact'
                      type='button'
                      variant='ghost'
                    >
                      Max ({formatTokenAmount(balances.token, sourceToken.decimals)} {sourceToken.symbol})
                    </Button>
                  )}
                </div>
                <Input
                  disabled={isBusy || !sourceToken}
                  id={amountInputId}
                  min='0'
                  onChange={setAmount}
                  placeholder='0.00'
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
              </div>

              {payingWallet && sourceToken && (
                <TopUpWalletPanel
                  hasPrivyLogin={hasPrivyLogin}
                  isBusy={isBusy}
                  onBuyWithCard={() => void buyUsdcWithCard()}
                  onLogin={login}
                  onTransfer={() => void transferUsdcToPrivyWallet()}
                  payerLabel={payerLabel}
                  showEmptyWalletHint={showEmptyWalletHint}
                  sourceNetworkName={sourceChain?.name ?? "this network"}
                  tokenSymbol={sourceToken.symbol}
                />
              )}

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
                <QuoteSummary quote={quote} rate={rate} tokenSymbol={sourceToken.symbol} />
              )}

              {hasInsufficientGas && sourceChain && requiredNative !== null && (
                <GasShortfallPanel
                  gasTopUpAmount={gasTopUpAmount}
                  hasPrivyLogin={hasPrivyLogin}
                  isBusy={isBusy}
                  nativeSymbol={nativeSymbol}
                  networkName={sourceChain.name}
                  onAddGas={() => void addGasToPrivyWallet()}
                  onLogin={login}
                  requiredNative={requiredNative}
                />
              )}

              {stage && (
                <div className='grid gap-1 rounded-md border p-3' role='status'>
                  <p className='inline-flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    {describeStage(stage, { hasApproved: execution.hasApproved, isEmbedded })}
                  </p>
                  {execution.transactionHash && (
                    <TransactionLink explorerUrl={explorerUrl} hash={execution.transactionHash} />
                  )}
                </div>
              )}
              {execution.error && (
                <p className='text-destructive' role='alert'>
                  {execution.error}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button disabled={isBusy} onClick={() => handleOpenChange(false)} type='button' variant='ghost'>
            {pendingDeposit ? "Close" : "Cancel"}
          </Button>
          {!pendingDeposit && (
            <Button
              aria-label='Fund with USDC'
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
              type='button'
              variant='primary'
            >
              {stage ? (
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
