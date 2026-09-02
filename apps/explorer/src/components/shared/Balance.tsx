"use client";
import { Button } from "@filecoin-pay/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@filecoin-pay/ui/components/dropdown-menu";
import { Skeleton } from "@filecoin-pay/ui/components/skeleton";
import { useConnectWallet, useExportWallet, usePrivy } from "@privy-io/react-auth";
import {
  ArrowUpRightIcon,
  Check,
  Coins,
  Copy,
  CreditCard,
  KeyRound,
  LogOut,
  PlugZap,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { type Address, erc20Abi, formatEther } from "viem";
import { useAccount, useBalance, useDisconnect, useReadContract, useWalletClient } from "wagmi";
import FilecoinLogo from "@/assests/FilecoinLogo";
import USDFCLogo from "@/assests/USDFCLogo";
import { useFundingLaunch } from "@/components/UserConsole/FundingLaunchContext";
import { isUsdcFundingAvailable } from "@/components/UserConsole/FundsSection/data/usdc-funding-availability";
import { useCardPurchase } from "@/components/UserConsole/FundsSection/hooks/useCardPurchase";
import { isReviewEnabled, setReviewEnabled, useIsEmbeddedSigner } from "@/components/UserConsole/TransactionReview";
import useSynapse from "@/hooks/useSynapse";
import { formatAddress } from "@/utils/formatter";

/**
 * The wallet pill and its menu: who the console is acting as, how to add
 * funds, wallet settings, and last of all the way out.
 */
const Balance = () => {
  const { constants } = useSynapse();
  const { address, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, logout, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { exportWallet } = useExportWallet();
  const { openUsdcFunding } = useFundingLaunch();
  const canFundWithUsdc = isUsdcFundingAvailable(chainId);
  const card = useCardPurchase({ address, onPurchased: openUsdcFunding });
  const isEmbeddedSigner = useIsEmbeddedSigner();
  const [reviewOn, setReviewOn] = useState(() => isReviewEnabled());
  const { data: walletClient } = useWalletClient();
  const [copied, setCopied] = useState(false);
  const { data: tFilBalance, isLoading: isLoadingtFilBalance } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const { data: usdfcBalance, isLoading: isLoadingUSDFCBalance } = useReadContract({
    address: constants.contracts.usdfc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: !!address },
  });

  const usdfcBalanceFormatted = usdfcBalance ? Number(formatEther(usdfcBalance)).toFixed(2) : "0";
  const tFilBalanceFormatted = tFilBalance ? Number(formatEther(tFilBalance.value)).toFixed(2) : "0";
  const isLoading = isLoadingtFilBalance || isLoadingUSDFCBalance;

  // Who the console acts as: the login for Privy sessions, the wallet app otherwise.
  const loginName = user?.email?.address ?? user?.google?.email ?? user?.google?.name;
  const identity = authenticated
    ? `Logged in as ${loginName ?? "a Privy user"}`
    : `${connector?.name ?? "External"} wallet`;

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addUsdfcToken = async () => {
    if (!walletClient) return;
    try {
      await walletClient.watchAsset({
        type: "ERC20",
        options: {
          address: constants.contracts.usdfc,
          symbol: "USDFC",
          decimals: 18,
        },
      });
    } catch (error) {
      console.error("Failed to add token:", error);
    }
  };

  const signOut = () => {
    // Privy sessions (email/social/SIWE) need logout; a wagmi disconnect alone
    // would leave the session alive and re-connect the wallet on reload.
    // Connect-only wallets just disconnect.
    if (authenticated) void logout();
    disconnect();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' className='min-w-0 flex-1 justify-start md:flex-none md:w-fit'>
          <div className='flex items-center gap-3'>
            <Wallet className='size-4 text-muted-foreground' />
            {isLoading ? (
              <>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-14' />
                <Skeleton className='h-4 w-16' />
              </>
            ) : (
              <>
                <span className='font-mono text-sm'>{address && formatAddress(address)}</span>
                {/* Balances live in the dashboard too, so the smallest screens keep only the address. */}
                <span className='hidden items-center gap-1.5 text-sm sm:flex'>
                  <FilecoinLogo className='size-4' /> {tFilBalanceFormatted} FIL
                </span>
                <span className='hidden items-center gap-1.5 text-sm sm:flex'>
                  <USDFCLogo className='size-4' /> {usdfcBalanceFormatted} USDFC
                </span>
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-72' align='start'>
        <DropdownMenuLabel className='grid gap-0.5 py-2 font-normal'>
          <span className='text-sm font-medium text-foreground'>{identity}</span>
          <span className='font-mono text-xs text-muted-foreground'>{address}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={copyToClipboard}
          className='cursor-pointer py-2'
        >
          {copied ? <Check className='text-primary' /> : <Copy />}
          <span className='text-base'>{copied ? "Copied" : "Copy address"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='py-2 text-muted-foreground'>Funding</DropdownMenuLabel>
          {canFundWithUsdc ? (
            <DropdownMenuItem onClick={openUsdcFunding} className='cursor-pointer py-2'>
              <Coins />
              <span className='text-base'>Add funds</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => void card.buyWithCard()} className='cursor-pointer py-2'>
            <CreditCard />
            <span className='text-base'>{card.label}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => connectWallet()} className='cursor-pointer py-2'>
            <PlugZap />
            <span className='text-base'>Connect another wallet</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='py-2 text-muted-foreground'>Settings</DropdownMenuLabel>
          {isEmbeddedSigner ? (
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              onClick={() => {
                const next = !reviewOn;
                setReviewEnabled(next);
                setReviewOn(next);
              }}
              className='cursor-pointer py-2'
            >
              <ShieldCheck className={reviewOn ? "text-primary" : "text-muted-foreground"} />
              <span className='text-base'>Review before signing: {reviewOn ? "On" : "Off"}</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={addUsdfcToken} className='cursor-pointer py-2'>
            <Wallet />
            <span className='text-base'>Add USDFC to wallet</span>
          </DropdownMenuItem>
          {isEmbeddedSigner ? (
            <DropdownMenuItem onClick={() => void exportWallet()} className='cursor-pointer py-2'>
              <KeyRound />
              <span className='text-base'>Export wallet key</span>
            </DropdownMenuItem>
          ) : null}
          {constants.faucets?.map((faucet) => (
            <DropdownMenuItem asChild key={faucet.name} className='py-2'>
              <a href={faucet.url} target='_blank' rel='noopener noreferrer' className='w-full cursor-pointer'>
                <span className='text-base'>{faucet.name}</span>
                <ArrowUpRightIcon className='text-muted-foreground' size={16} />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className='cursor-pointer py-2'>
          <LogOut />
          <span className='text-base'>{authenticated ? "Log out" : "Disconnect"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Balance;
