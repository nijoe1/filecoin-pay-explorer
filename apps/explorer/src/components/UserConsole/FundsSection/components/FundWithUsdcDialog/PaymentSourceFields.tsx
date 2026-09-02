import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Label } from "@filecoin-pay/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@filecoin-pay/ui/components/select";
import type { SourceToken } from "@filecoin-project/squid-evm-funding";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { SQUID_SOURCE_CHAINS } from "@/constants/chains";
import { formatAddress } from "@/utils/formatter";
import type { SourceChain } from "./useSquidDepositExecution";
import { describeWallet } from "./wallets";

/** Which wallet pays, on which network, with which USDC. */
export function PaymentSourceFields({
  areWalletsReady,
  isBusy,
  isCollapsed,
  onExpand,
  onConnectAnother,
  onPayingAddressChange,
  onSourceChainChange,
  onSourceTokenChange,
  payingWallet,
  sourceChain,
  sourceChainId,
  sourceToken,
  tokensQuery,
  usdcTokens,
  wallets,
}: {
  areWalletsReady: boolean;
  isBusy: boolean;
  /** One summary line with a Change action, until the user wants to pick differently. */
  isCollapsed: boolean;
  onConnectAnother: () => void;
  onExpand: () => void;
  onPayingAddressChange: (address: string) => void;
  onSourceChainChange: (chainId: number) => void;
  onSourceTokenChange: (token: string) => void;
  payingWallet: ConnectedWallet | undefined;
  sourceChain: SourceChain | undefined;
  sourceChainId: number;
  sourceToken: SourceToken | undefined;
  tokensQuery: { isError: boolean; isPending: boolean };
  usdcTokens: SourceToken[];
  wallets: ConnectedWallet[];
}) {
  if (isCollapsed && payingWallet && sourceToken) {
    return (
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
        <span>
          <span className='text-muted-foreground'>From </span>
          {describeWallet(payingWallet)}
          <span className='text-muted-foreground'> on </span>
          {sourceChain?.name ?? "this network"}
          {usdcTokens.length > 1 ? <span className='text-muted-foreground'> · {sourceToken.symbol}</span> : null}
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
  // Only when two listed tokens share a symbol does the address tell them apart.
  const showTokenAddresses = new Set(usdcTokens.map((token) => token.symbol)).size < usdcTokens.length;
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
          <Label htmlFor='fund-with-usdc-network'>Network</Label>
          <Select
            disabled={isBusy}
            onValueChange={(value) => onSourceChainChange(Number(value))}
            value={String(sourceChainId)}
          >
            <SelectTrigger aria-label='Source network' className='w-full' id='fund-with-usdc-network'>
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
      </div>

      {usdcTokens.length > 1 && (
        <div className='grid gap-2'>
          <Label htmlFor='fund-with-usdc-token'>USDC token</Label>
          <Select disabled={isBusy} onValueChange={onSourceTokenChange} value={sourceToken?.token ?? ""}>
            <SelectTrigger aria-label='USDC token' className='w-full' id='fund-with-usdc-token'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {usdcTokens.map((token) => (
                <SelectItem key={token.token} value={token.token}>
                  {showTokenAddresses ? `${token.symbol} (${formatAddress(token.token)})` : token.symbol}
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
    </>
  );
}
