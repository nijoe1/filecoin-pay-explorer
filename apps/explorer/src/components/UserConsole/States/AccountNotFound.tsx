"use client";

import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { EmptyStateCard } from "@filecoin-foundation/ui-filecoin/EmptyStateCard";
import { WalletIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useConnection } from "wagmi";
import DepositAndApproveDialog from "../DepositAndApproveDialog";
import { DepositDialog } from "../DepositDialog";
import { useFundingLaunch } from "../FundingLaunchContext";
import { AddFundsDialog, type AddFundsMethod } from "../FundsSection/components";
import { useCardPurchase } from "../FundsSection/hooks/useCardPurchase";

type AccountNotFoundProps = {
  /** Opens the guided any-token swap; absent where Squid funding is unavailable. */
  onGuidedTopUp?: () => void;
};

/**
 * The first thing a new account sees. One primary action opens the same
 * add-funds picker the dashboard uses, so the paths that work for an empty
 * wallet (card, USDC, a swap) sit next to a plain deposit for USDFC holders.
 */
const AccountNotFound = ({ onGuidedTopUp }: AccountNotFoundProps) => {
  const { openUsdcFunding } = useFundingLaunch();
  const { address } = useConnection();
  const card = useCardPurchase({ address, onPurchased: openUsdcFunding });
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAndApproveOpen, setDepositAndApproveOpen] = useState(false);
  const squidAvailable = Boolean(onGuidedTopUp);

  const chooseMethod = (method: AddFundsMethod) => {
    setAddFundsOpen(false);
    if (method === "usdc") openUsdcFunding();
    else if (method === "card") void card.buyWithCard();
    else if (method === "squid") onGuidedTopUp?.();
    else setDepositOpen(true);
  };

  return (
    <EmptyStateCard
      titleTag='h2'
      icon={WalletIcon}
      title='Welcome to Filecoin Pay'
      description='Add funds to your account to start paying for services.'
    >
      <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
        <Button onClick={() => setAddFundsOpen(true)} size='compact' variant='primary'>
          Add funds
        </Button>
        <Button onClick={() => setDepositAndApproveOpen(true)} size='compact' variant='ghost'>
          Deposit and approve a service
        </Button>
      </div>

      <AddFundsDialog
        cardLabel={card.label}
        onOpenChange={setAddFundsOpen}
        onSelect={chooseMethod}
        open={addFundsOpen}
        squidAvailable={squidAvailable}
      />
      {/* No indexed tokens yet, so the deposit picker only offers address entry. */}
      <DepositDialog tokens={[]} open={depositOpen} onOpenChange={setDepositOpen} />
      <DepositAndApproveDialog open={depositAndApproveOpen} onOpenChange={setDepositAndApproveOpen} />
    </EmptyStateCard>
  );
};

export default AccountNotFound;
