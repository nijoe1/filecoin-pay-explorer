import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Label } from "@filecoin-pay/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@filecoin-pay/ui/components/select";
import type { SourceToken } from "@filecoin-project/squid-evm-funding";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { SQUID_SOURCE_CHAINS } from "@/constants/chains";
import {
  buildUsdcSourceOptions,
  formatUsdcBalance,
  isSameUsdcSource,
  parseUsdcSourceValue,
  toSelectedUsdcSourceValue,
  type UsdcSource,
  type UsdcSourceChoice,
} from "../../data/usdc-sources";
import type { SourceChain } from "./useSquidDepositExecution";
import { describeWallet } from "./wallets";

/** Which wallet pays, and with which USDC on which network. */
export function PaymentSourceFields({
  areWalletsReady,
  isBusy,
  isCollapsed,
  isScanning,
  onConnectAnother,
  onExpand,
  onPayingAddressChange,
  onSourceChange,
  payingWallet,
  sourceChain,
  sourceChoice,
  sources,
  sourceToken,
  tokensQuery,
  usdcTokens,
  wallets,
}: {
  areWalletsReady: boolean;
  isBusy: boolean;
  /** One summary line with a Change action, until the user wants to pick differently. */
  isCollapsed: boolean;
  /** True while some network has not reported its balances yet. */
  isScanning: boolean;
  onConnectAnother: () => void;
  onExpand: () => void;
  onPayingAddressChange: (address: string) => void;
  onSourceChange: (choice: UsdcSourceChoice) => void;
  payingWallet: ConnectedWallet | undefined;
  sourceChain: SourceChain | undefined;
  sourceChoice: UsdcSourceChoice;
  /** The paying wallet's USDC on every network, largest first. */
  sources: readonly UsdcSource[];
  sourceToken: SourceToken | undefined;
  tokensQuery: { isError: boolean; isPending: boolean };
  usdcTokens: SourceToken[];
  wallets: ConnectedWallet[];
}) {
  const selectedSource = sources.find((source) => isSameUsdcSource(source, sourceChoice));
  if (isCollapsed && payingWallet && sourceToken) {
    return (
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
        <span>
          <span className='text-muted-foreground'>From </span>
          {describeWallet(payingWallet)}
          <span className='text-muted-foreground'> on </span>
          {sourceChain?.name ?? "this network"}
          {selectedSource ? (
            <span className='text-muted-foreground'>
              {" "}
              · {formatUsdcBalance(selectedSource)} {sourceToken.symbol}
            </span>
          ) : null}
        </span>
        <Button
          aria-label='Change payment source'
          disabled={isBusy}
          onClick={onExpand}
          size='compact'
          type='button'
          variant='ghost'
        >
          Change
        </Button>
      </div>
    );
  }
  const { funded, other } = buildUsdcSourceOptions({ chains: SQUID_SOURCE_CHAINS, sources });
  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2'>
          <div className='flex items-center justify-between gap-2'>
            <Label htmlFor='fund-with-usdc-wallet'>Pay from</Label>
            <Button
              aria-label='Connect another wallet'
              disabled={isBusy}
              onClick={onConnectAnother}
              size='compact'
              type='button'
              variant='ghost'
            >
              Connect another
            </Button>
          </div>
          <Select
            disabled={isBusy || !areWalletsReady || wallets.length === 0}
            onValueChange={onPayingAddressChange}
            value={payingWallet?.address ?? ""}
          >
            <SelectTrigger aria-label='Paying wallet' className='w-full' id='fund-with-usdc-wallet'>
              <SelectValue placeholder={areWalletsReady ? "Choose a wallet" : "Loading wallets…"} />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((wallet) => (
                <SelectItem key={wallet.address} value={wallet.address}>
                  {describeWallet(wallet)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-2'>
          <div className='flex h-6 items-center justify-between gap-2'>
            <Label htmlFor='fund-with-usdc-source'>Pay with</Label>
            {isScanning ? <span className='text-xs text-muted-foreground'>Checking balances…</span> : null}
          </div>
          <Select
            disabled={isBusy}
            onValueChange={(value) => onSourceChange(parseUsdcSourceValue(value))}
            value={toSelectedUsdcSourceValue(sourceChoice, sources)}
          >
            <SelectTrigger aria-label='Payment source' className='w-full' id='fund-with-usdc-source'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {funded.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Your USDC</SelectLabel>
                  {funded.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {other.length > 0 && (
                <SelectGroup>
                  <SelectLabel>{funded.length > 0 ? "Other networks" : "Networks"}</SelectLabel>
                  {other.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      {tokensQuery.isError && (
        <p className='text-destructive' role='alert'>
          Could not load Squid's token list. Try again shortly.
        </p>
      )}
      {!tokensQuery.isPending && !tokensQuery.isError && usdcTokens.length === 0 && (
        <p className='text-muted-foreground'>Squid lists no USDC on {sourceChain?.name ?? "this network"}.</p>
      )}
    </>
  );
}
