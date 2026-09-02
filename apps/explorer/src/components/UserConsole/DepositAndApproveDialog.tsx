import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Input } from "@filecoin-foundation/ui-filecoin/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@filecoin-pay/ui/components/dialog";
import { Label } from "@filecoin-pay/ui/components/label";
import { Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import { useTransactionReview } from "@/components/UserConsole/TransactionReview";
import { useContractTransaction } from "@/hooks/useContractTransaction";
import useSynapse from "@/hooks/useSynapse";
import { getPermitSignature } from "@/utils/permit";
import { createDialogCloseGuard } from "./FundsSection/data/dialog-close-guard";
import {
  AllowanceFields,
  LockupPeriodField,
  ServiceAddressField,
  TokenAddressField,
  useServiceApprovalForm,
} from "./ServiceApproval";

interface DepositAndApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DepositAndApproveDialog: React.FC<DepositAndApproveDialogProps> = ({ open, onOpenChange }) => {
  const [tokenAmount, setTokenAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { address: userAddress } = useAccount();
  const { synapse, constants } = useSynapse();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { requestReview, reviewDialog } = useTransactionReview();
  const { execute, isExecuting } = useContractTransaction({
    contractAddress: constants.contracts.payments.address,
    abi: constants.contracts.payments.abi,
    explorerUrl: constants.chain.blockExplorers?.default.url,
  });
  const form = useServiceApprovalForm({ open });
  const { tokenAddress, tokenDetails } = form;
  const isBusy = isSubmitting || isExecuting;

  const { data: balance, isLoading: isLoadingBalance } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!tokenAddress && !!userAddress && open },
  });

  const handleDepositAndApprove = async () => {
    const { lockupAllowanceWei, maxLockupEpochs, rateAllowanceWei, serviceAddress } = form;
    if (!form.isComplete || !serviceAddress || !tokenAddress || !tokenAmount || maxLockupEpochs === null) return;
    if (!tokenDetails || !synapse || !walletClient || !publicClient || !userAddress) return;

    const tokenAmountInWei = parseUnits(tokenAmount, tokenDetails.decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Embedded wallets sign without any wallet prompt, so the console shows
    // its own review step first (once per action; user can opt out).
    const approved = await requestReview({
      title: `Deposit ${tokenAmount} ${tokenDetails.symbol} and approve service`,
      rows: [
        { label: "Amount", value: `${tokenAmount} ${tokenDetails.symbol}` },
        { label: "Service", value: serviceAddress },
        { label: "Rate allowance", value: form.review.rateAllowance },
        { label: "Lockup allowance", value: form.review.lockupAllowance },
        { label: "Max lockup period", value: form.review.maxLockupPeriod },
        { label: "Network", value: constants.chain.name },
        { label: "Wallet", value: userAddress },
      ],
      details: JSON.stringify(
        {
          function: "depositWithPermitAndApproveOperator",
          token: tokenAddress,
          owner: userAddress,
          spender: constants.contracts.payments.address,
          amountWei: tokenAmountInWei.toString(),
          operator: serviceAddress,
          rateAllowanceWei: rateAllowanceWei.toString(),
          lockupAllowanceWei: lockupAllowanceWei.toString(),
          maxLockupPeriodEpochs: maxLockupEpochs.toString(),
          chainId: constants.chain.id,
        },
        null,
        2,
      ),
    });
    if (!approved) return;

    setIsSubmitting(true);
    try {
      const permitSignature = await getPermitSignature(
        {
          tokenAddress,
          ownerAddress: userAddress,
          spenderAddress: constants.contracts.payments.address,
          amount: tokenAmountInWei,
          deadline,
          chainId: constants.chain.id,
        },
        walletClient,
        publicClient,
      );

      await execute({
        functionName: "depositWithPermitAndApproveOperator",
        args: [
          tokenAddress,
          userAddress,
          tokenAmountInWei,
          permitSignature.deadline,
          permitSignature.v,
          permitSignature.r,
          permitSignature.s,
          serviceAddress,
          rateAllowanceWei,
          lockupAllowanceWei,
          maxLockupEpochs,
        ],
        metadata: {
          type: "depositAndApprove",
          amount: tokenAmount,
          token: tokenDetails.symbol,
          operator: serviceAddress,
        },
        onSubmitOnChain: () => onOpenChange(false),
      });
    } catch (err) {
      console.error("Deposit and Approve failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxClick = () => {
    if (balance !== undefined && tokenDetails) setTokenAmount(formatUnits(balance, tokenDetails.decimals));
  };

  const handleOpenChange = createDialogCloseGuard({
    blockReason: () => (isBusy ? "Wait for the transaction to finish before closing this dialog." : null),
    onClose: () => onOpenChange(false),
    onOpen: () => onOpenChange(true),
  });

  return (
    <>
      {reviewDialog}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>Deposit and approve a service</DialogTitle>
            <DialogDescription>
              Deposit tokens and let a service charge your account, within the limits you set, in one transaction.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-6 py-4'>
            <TokenAddressField disabled={isBusy} form={form} />

            {tokenDetails && (
              <div className='grid gap-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='deposit-and-approve-amount'>Amount</Label>
                  {(balance !== undefined || isLoadingBalance) && (
                    <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <Wallet className='h-3 w-3' />
                      <span>
                        Balance:{" "}
                        {isLoadingBalance || balance === undefined ? (
                          <Loader2 className='inline h-3 w-3 animate-spin' />
                        ) : (
                          <span className='font-medium text-foreground'>
                            {Number(formatUnits(balance, tokenDetails.decimals)).toLocaleString(undefined, {
                              maximumFractionDigits: 6,
                            })}{" "}
                            {tokenDetails.symbol}
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </div>
                <div className='relative'>
                  <Input
                    className='pr-16 text-lg'
                    disabled={isBusy}
                    id='deposit-and-approve-amount'
                    inputMode='decimal'
                    onChange={setTokenAmount}
                    placeholder='0.0'
                    type='text'
                    value={tokenAmount}
                  />
                  <Button
                    className='absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs font-semibold'
                    disabled={isBusy || balance === undefined || isLoadingBalance}
                    onClick={handleMaxClick}
                    type='button'
                    variant='ghost'
                  >
                    MAX
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>The amount of {tokenDetails.symbol} to deposit.</p>
              </div>
            )}

            <ServiceAddressField disabled={isBusy} form={form} />
            <AllowanceFields disabled={isBusy} form={form} />
            <LockupPeriodField disabled={isBusy} form={form} />
          </div>

          <DialogFooter>
            <Button variant='ghost' onClick={() => onOpenChange(false)} disabled={isBusy} size='compact'>
              Cancel
            </Button>
            <Button
              variant='primary'
              onClick={handleDepositAndApprove}
              disabled={!form.isComplete || !tokenAmount.trim() || isBusy}
              size='compact'
            >
              {isBusy ? (
                <span className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Processing…
                </span>
              ) : (
                "Deposit and approve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DepositAndApproveDialog;
