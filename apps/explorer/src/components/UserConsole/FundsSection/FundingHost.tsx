"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { DepositDialog } from "@/components/UserConsole/DepositDialog";
import { useFundingLaunch } from "@/components/UserConsole/FundingLaunchContext";
import { useAccountTokens } from "@/hooks/useAccountDetails";
import { getNetworkFromChainId } from "@/utils/network";
import { AddFundsDialog, type AddFundsMethod, FundWithUsdcDialog } from "./components";
import { isUsdcFundingAvailable } from "./data/usdc-funding-availability";
import { useCardPurchase } from "./hooks/useCardPurchase";

// One page covers every token an account realistically holds; see FundsSection.
const TOKEN_PAGE_SIZE = 100;

/**
 * The single place the console-wide funding dialogs are rendered: the
 * add-funds picker the wallet menu opens from any console page, the plain
 * deposit it can lead to, and the "Pay with USDC" dialog. It lives in the
 * console layout and keys on the address so a change of identity starts fresh.
 */
export function FundingHost() {
  const { address, chainId } = useConnection();
  if (!address) return null;
  return <FundingDialogs address={address} chainId={chainId} key={address} />;
}

function FundingDialogs({ address, chainId }: { address: string; chainId: number | undefined }) {
  const launch = useFundingLaunch();
  const [isDepositOpen, setDepositOpen] = useState(false);
  const network = getNetworkFromChainId(chainId);
  const canFundWithUsdc = isUsdcFundingAvailable(chainId);
  const card = useCardPurchase({ address, onPurchased: launch.openUsdcFunding });
  // Subgraph account ids are lowercase addresses.
  const accountId = address.toLowerCase();
  const { data: tokens } = useAccountTokens(accountId, 1, { networkOverride: network, pageSize: TOKEN_PAGE_SIZE });

  const chooseMethod = (method: AddFundsMethod) => {
    launch.closeAddFunds();
    if (method === "usdc") launch.openUsdcFunding();
    else if (method === "card") void card.buyWithCard();
    else if (method === "squid") launch.guidedTopUp?.();
    else setDepositOpen(true);
  };

  return (
    <>
      <AddFundsDialog
        cardLabel={card.label}
        onOpenChange={(open) => (open ? launch.openAddFunds() : launch.closeAddFunds())}
        onSelect={chooseMethod}
        open={launch.isAddFundsOpen}
        squidAvailable={canFundWithUsdc}
        squidDisabledReason={canFundWithUsdc ? "Open the dashboard to swap another token." : undefined}
        swapAvailable={canFundWithUsdc && launch.guidedTopUp !== null}
      />
      {/* No seeded token, so the deposit opens on its picker. */}
      <DepositDialog onOpenChange={setDepositOpen} open={isDepositOpen} tokens={tokens?.userTokens ?? []} />
      {canFundWithUsdc ? (
        <FundWithUsdcDialog
          accountId={accountId}
          onOpenChange={(open) => (open ? launch.openUsdcFunding() : launch.closeUsdcFunding())}
          open={launch.isUsdcFundingOpen}
        />
      ) : null}
    </>
  );
}
