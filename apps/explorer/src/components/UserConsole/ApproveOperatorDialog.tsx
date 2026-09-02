import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import type { Operator, Token } from "@filecoin-pay/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@filecoin-pay/ui/components/dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTransactionReview } from "@/components/UserConsole/TransactionReview";
import { useContractTransaction } from "@/hooks/useContractTransaction";
import useSynapse from "@/hooks/useSynapse";
import { formatAddress } from "@/utils/formatter";
import { createDialogCloseGuard } from "./FundsSection/data/dialog-close-guard";
import {
  AllowanceFields,
  LockupPeriodField,
  ServiceAddressField,
  TokenAddressField,
  useServiceApprovalForm,
} from "./ServiceApproval";

interface ApproveOperatorDialogProps {
  operators?: Operator[];
  tokens?: Token[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApproveOperatorDialog: React.FC<ApproveOperatorDialogProps> = ({
  operators = [],
  tokens = [],
  open,
  onOpenChange,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { synapse, constants } = useSynapse();
  const { requestReview, reviewDialog } = useTransactionReview();
  const { execute, isExecuting } = useContractTransaction({
    contractAddress: constants.contracts.payments.address,
    abi: constants.contracts.payments.abi,
    explorerUrl: constants.chain.blockExplorers?.default.url,
  });
  const form = useServiceApprovalForm({ open, services: operators, tokens });
  const isBusy = isSubmitting || isExecuting;

  const handleApprove = async () => {
    const { lockupAllowanceWei, maxLockupEpochs, rateAllowanceWei, serviceAddress, tokenAddress, tokenDetails } = form;
    if (!form.isComplete || !serviceAddress || !tokenAddress || maxLockupEpochs === null || !tokenDetails || !synapse) {
      return;
    }
    setIsSubmitting(true);

    // Embedded wallets sign without any wallet prompt, so the console shows
    // its own review step first (once per action; user can opt out).
    const approved = await requestReview({
      title: `Approve service ${formatAddress(serviceAddress)}`,
      rows: [
        { label: "Service", value: serviceAddress },
        { label: "Token", value: `${tokenDetails.symbol} ${tokenAddress}` },
        { label: "Rate allowance", value: form.review.rateAllowance },
        { label: "Lockup allowance", value: form.review.lockupAllowance },
        { label: "Max lockup period", value: form.review.maxLockupPeriod },
      ],
      details: JSON.stringify(
        {
          function: "setOperatorApproval",
          token: tokenAddress,
          operator: serviceAddress,
          approved: true,
          rateAllowanceWei: rateAllowanceWei.toString(),
          lockupAllowanceWei: lockupAllowanceWei.toString(),
          maxLockupPeriodEpochs: maxLockupEpochs.toString(),
        },
        null,
        2,
      ),
    });
    if (!approved) {
      setIsSubmitting(false);
      return;
    }

    try {
      await execute({
        functionName: "setOperatorApproval",
        args: [tokenAddress, serviceAddress, true, rateAllowanceWei, lockupAllowanceWei, maxLockupEpochs],
        metadata: { type: "approveOperator", operator: serviceAddress, token: tokenDetails.symbol },
        onSubmitOnChain: () => onOpenChange(false),
        onError: (err) => console.log("[setOperatorApproval]: Failed ", err),
      });
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = createDialogCloseGuard({
    blockReason: () => (isBusy ? "Wait for the approval to finish before closing this dialog." : null),
    onClose: () => onOpenChange(false),
    onOpen: () => onOpenChange(true),
  });

  return (
    <>
      {reviewDialog}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>Approve a service</DialogTitle>
            <DialogDescription>Let a service charge your account, within the limits you set.</DialogDescription>
          </DialogHeader>

          <div className='grid gap-6 py-4'>
            <ServiceAddressField disabled={isBusy} form={form} />
            <TokenAddressField disabled={isBusy} form={form} />
            <AllowanceFields disabled={isBusy} form={form} />
            <LockupPeriodField disabled={isBusy} form={form} />
          </div>

          <DialogFooter>
            <Button variant='ghost' onClick={() => onOpenChange(false)} disabled={isBusy} size='compact'>
              Cancel
            </Button>
            <Button variant='primary' onClick={handleApprove} disabled={!form.isComplete || isBusy} size='compact'>
              {isBusy ? (
                <span className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Processing…
                </span>
              ) : (
                "Approve service"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
