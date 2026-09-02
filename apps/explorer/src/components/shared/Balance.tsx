"use client";
import { Button } from "@filecoin-pay/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@filecoin-pay/ui/components/dropdown-menu";
import { useConnectWallet, useExportWallet, useFiatOnramp, useLogin, usePrivy } from "@privy-io/react-auth";
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
import { useRef, useState } from "react";
import { toast } from "sonner";
import { type Address, erc20Abi, formatEther } from "viem";
import { useAccount, useBalance, useDisconnect, useReadContract, useWalletClient } from "wagmi";
import FilecoinLogo from "@/assests/FilecoinLogo";
import USDFCLogo from "@/assests/USDFCLogo";
import { useFundingLaunch } from "@/components/UserConsole/FundingLaunchContext";
import { isUsdcFundingAvailable } from "@/components/UserConsole/FundsSection/data/usdc-funding-availability";
import {
  BASE_CHAIN_ID,
  BASE_USDC,
  buildCardOnrampOptions,
  isFundingExit,
  readOnrampEnvironment,
} from "@/components/UserConsole/privy-funding";
import { isReviewEnabled, setReviewEnabled, useIsEmbeddedSigner } from "@/components/UserConsole/TransactionReview";
import useSynapse from "@/hooks/useSynapse";
import { formatAddress } from "@/utils/formatter";

const Balance = () => {
  const { constants } = useSynapse();
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, logout } = usePrivy();
  const { fund: fundWithCard } = useFiatOnramp();
  const { connectWallet } = useConnectWallet();
  const { exportWallet } = useExportWallet();
  const { openUsdcFunding } = useFundingLaunch();
  const canFundWithUsdc = isUsdcFundingAvailable(chainId);
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

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /** Privy's card onramp into the console wallet on Base, then straight into USDC funding. */
  const buyUsdcWithCard = async () => {
    if (!address) return;
    try {
      await fundWithCard(
        buildCardOnrampOptions({
          address,
          asset: BASE_USDC,
          chainId: BASE_CHAIN_ID,
          environment: readOnrampEnvironment(),
        }),
      );
      openUsdcFunding();
    } catch (error) {
      if (!isFundingExit(error)) {
        toast.error("Card purchases are unavailable", {
          description: error instanceof Error ? error.message : "Enable funding in the Privy dashboard.",
        });
      }
    }
  };

  // Privy's onramp needs a Privy session, so a connect-only wallet logs in
  // first and the purchase continues once login completes.
  const cardPurchaseAfterLogin = useRef(false);
  const { login } = useLogin({
    onComplete: () => {
      if (!cardPurchaseAfterLogin.current) return;
      cardPurchaseAfterLogin.current = false;
      void buyUsdcWithCard();
    },
  });
  const buyUsdcWithCardOrLogin = () => {
    if (authenticated) return buyUsdcWithCard();
    cardPurchaseAfterLogin.current = true;
    login();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' className='w-full justify-start md:w-fit'>
          <div className='flex items-center gap-3'>
            <Wallet className='size-4 text-zinc-500' />
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                <span className='text-sm font-mono'>{address && formatAddress(address)}</span>
                <span className='flex items-center gap-1.5 text-sm'>
                  <FilecoinLogo className='size-4' /> {tFilBalanceFormatted}
                </span>
                <span className='flex items-center gap-1.5 text-sm'>
                  <USDFCLogo className='size-4' /> {usdfcBalanceFormatted}
                </span>
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-64' align='start'>
        <DropdownMenuLabel className='text-zinc-600 py-2'>Wallet</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={copyToClipboard}
          className='cursor-pointer py-2'
        >
          <Copy />
          <span className='text-base text-zinc-950 font-mono'>{address && formatAddress(address)}</span>
          {copied && <Check className='text-green-500 ml-auto' />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            // Privy sessions (email/social/SIWE) need logout; a wagmi
            // disconnect alone would leave the session alive and re-connect
            // the wallet on reload. Connect-only wallets just disconnect.
            if (authenticated) {
              void logout();
            }
            disconnect();
          }}
          className='cursor-pointer py-2'
        >
          <LogOut />
          <span className='text-base text-zinc-950'>{authenticated ? "Log out" : "Disconnect"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='text-zinc-600 py-2'>Funding</DropdownMenuLabel>
        {canFundWithUsdc ? (
          <DropdownMenuItem onClick={openUsdcFunding} className='cursor-pointer py-2'>
            <Coins />
            <span className='text-base text-zinc-950'>Fund with USDC</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => void buyUsdcWithCardOrLogin()} className='cursor-pointer py-2'>
          <CreditCard />
          <span className='text-base text-zinc-950'>
            {authenticated ? "Buy USDC with card" : "Log in to buy with card"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet()} className='cursor-pointer py-2'>
          <PlugZap />
          <span className='text-base text-zinc-950'>Connect another wallet</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='text-zinc-600 py-2'>Tools</DropdownMenuLabel>
        {isEmbeddedSigner ? (
          <DropdownMenuItem onClick={() => void exportWallet()} className='cursor-pointer py-2'>
            <KeyRound />
            <span className='text-base text-zinc-950'>Export wallet key</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={addUsdfcToken} className='cursor-pointer'>
          <span className='text-base text-zinc-950'>Add USDFC Token</span>
        </DropdownMenuItem>
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
            <ShieldCheck className={reviewOn ? "text-green-600" : "text-zinc-400"} />
            <span className='text-base text-zinc-950'>Review before signing: {reviewOn ? "On" : "Off"}</span>
          </DropdownMenuItem>
        ) : null}
        {constants.faucets?.map((faucet) => (
          <DropdownMenuItem asChild key={faucet.name} className='py-2'>
            <a href={faucet.url} target='_blank' rel='noopener noreferrer' className='w-full cursor-pointer'>
              <span className='text-base text-zinc-950'>{faucet.name}</span>
              <ArrowUpRightIcon color='var(--color-zinc-400)' size={16} />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Balance;
