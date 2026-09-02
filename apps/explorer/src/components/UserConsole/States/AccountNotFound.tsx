"use client";

import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { EmptyStateCard } from "@filecoin-foundation/ui-filecoin/EmptyStateCard";
import { WalletIcon } from "@phosphor-icons/react";
import { useState } from "react";
import DepositAndApproveDialog from "../DepositAndApproveDialog";
import { useFundingLaunch } from "../FundingLaunchContext";

/**
 * The first thing a new account sees. One primary action opens the same
 * add-funds picker the dashboard uses (FundingHost renders it, or the plain
 * deposit where USDC funding is unavailable), so the paths that work for an
 * empty wallet sit next to a plain deposit for USDFC holders.
 */
const AccountNotFound = () => {
  const { openAddFunds } = useFundingLaunch();
  const [depositAndApproveOpen, setDepositAndApproveOpen] = useState(false);

  return (
    <EmptyStateCard
      titleTag='h2'
      icon={WalletIcon}
      title='Welcome to Filecoin Pay'
      description='Add funds to your account to start paying for services.'
    >
      <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
        <Button onClick={() => openAddFunds()} size='compact' variant='primary'>
          Add funds
        </Button>
        <Button onClick={() => setDepositAndApproveOpen(true)} size='compact' variant='ghost'>
          Deposit and approve a service
        </Button>
      </div>

      <DepositAndApproveDialog open={depositAndApproveOpen} onOpenChange={setDepositAndApproveOpen} />
    </EmptyStateCard>
  );
};

export default AccountNotFound;
