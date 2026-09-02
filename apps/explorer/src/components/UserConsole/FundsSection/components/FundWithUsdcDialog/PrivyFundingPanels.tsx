import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { AlertCircle } from "lucide-react";
import { formatTokenAmount, NATIVE_FRACTION_DIGITS } from "./wallets";

/** Offers to put USDC into the paying wallet through Privy's card onramp or transfer picker. */
export function TopUpWalletPanel({
  hasPrivyLogin,
  isBusy,
  onBuyWithCard,
  onLogin,
  onTransfer,
  payerLabel,
  showEmptyWalletHint,
  sourceNetworkName,
  tokenSymbol,
}: {
  hasPrivyLogin: boolean;
  isBusy: boolean;
  onBuyWithCard: () => void;
  onLogin: () => void;
  onTransfer: () => void;
  payerLabel: string;
  showEmptyWalletHint: boolean;
  sourceNetworkName: string;
  tokenSymbol: string;
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
      <span className='text-muted-foreground'>
        {showEmptyWalletHint
          ? `${payerLabel[0].toUpperCase()}${payerLabel.slice(1)} holds no ${tokenSymbol} on ${sourceNetworkName} yet.`
          : `Top up ${payerLabel}.`}
      </span>
      <span className='flex flex-wrap gap-2'>
        <Button
          aria-label={hasPrivyLogin ? "Buy USDC with card" : "Log in to buy with card"}
          disabled={isBusy}
          onClick={hasPrivyLogin ? onBuyWithCard : onLogin}
          size='compact'
          type='button'
          variant='primary'
        >
          {hasPrivyLogin ? "Buy with card" : "Log in to buy with card"}
        </Button>
        {hasPrivyLogin && (
          <Button
            aria-label='Add USDC with Privy'
            disabled={isBusy}
            onClick={onTransfer}
            size='compact'
            type='button'
            variant='tertiary'
          >
            Transfer
          </Button>
        )}
      </span>
    </div>
  );
}

/** The paying wallet lacks gas for the approval and the swap. */
export function GasShortfallPanel({
  gasTopUpAmount,
  hasPrivyLogin,
  isBusy,
  nativeSymbol,
  networkName,
  onAddGas,
  onLogin,
  requiredNative,
}: {
  gasTopUpAmount: string;
  hasPrivyLogin: boolean;
  isBusy: boolean;
  nativeSymbol: string;
  networkName: string;
  onAddGas: () => void;
  onLogin: () => void;
  requiredNative: bigint;
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
      <span className='inline-flex items-start gap-2'>
        <AlertCircle aria-hidden className='mt-0.5 h-4 w-4 shrink-0 text-destructive' />
        <span>
          Needs about {formatTokenAmount(requiredNative, 18, NATIVE_FRACTION_DIGITS)} {nativeSymbol} on {networkName}{" "}
          for gas and fees.
        </span>
      </span>
      <Button
        aria-label={hasPrivyLogin ? "Add gas with Privy" : "Log in to add gas"}
        disabled={isBusy}
        onClick={hasPrivyLogin ? onAddGas : onLogin}
        size='compact'
        type='button'
        variant='tertiary'
      >
        {hasPrivyLogin ? `Add ${gasTopUpAmount} ${nativeSymbol}` : "Log in to add gas"}
      </Button>
    </div>
  );
}
