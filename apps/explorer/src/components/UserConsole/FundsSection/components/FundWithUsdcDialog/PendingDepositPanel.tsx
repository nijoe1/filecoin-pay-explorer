import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Loader2 } from "lucide-react";
import type { PendingSquidDeposit } from "../../data/squid-deposit-tracker";
import { describeStage, type UiStage } from "./stages";
import { TransactionLink } from "./TransactionLink";

/** A deposit that has been broadcast and is being followed to its Filecoin Pay credit. */
export function PendingDepositPanel({
  activeStage,
  error,
  explorerUrl,
  hasApproved,
  isBusy,
  isEmbedded,
  onCheckAgain,
  onDismiss,
  pendingDeposit,
}: {
  activeStage: UiStage | null;
  error: string | null;
  explorerUrl?: string;
  hasApproved: boolean;
  isBusy: boolean;
  isEmbedded: boolean;
  onCheckAgain: () => void;
  onDismiss: () => void;
  pendingDeposit: PendingSquidDeposit;
}) {
  return (
    <div className='grid gap-2 rounded-md border p-3' role='status'>
      <p className='inline-flex items-center gap-2 font-medium'>
        {isBusy ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
        Deposit in progress
      </p>
      <p className='text-muted-foreground'>
        {activeStage ? describeStage(activeStage, { hasApproved, isEmbedded }) : "Waiting for the route to settle…"}
      </p>
      <TransactionLink explorerUrl={explorerUrl} hash={pendingDeposit.transactionHash} />
      {error && (
        <p className='text-destructive' role='alert'>
          {error}
        </p>
      )}
      <div className='flex flex-wrap gap-2'>
        <Button
          aria-label='Check deposit again'
          disabled={isBusy}
          onClick={onCheckAgain}
          size='compact'
          type='button'
          variant='tertiary'
        >
          Check again
        </Button>
        <Button
          aria-label='Dismiss pending deposit'
          disabled={isBusy}
          onClick={onDismiss}
          size='compact'
          type='button'
          variant='ghost'
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
