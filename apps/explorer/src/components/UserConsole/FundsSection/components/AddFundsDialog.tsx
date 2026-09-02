"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@filecoin-pay/ui/components/dialog";
import { ArrowRight, Coins, Repeat, Wallet } from "lucide-react";
import type { ReactNode } from "react";

export type AddFundsMethod = "deposit" | "squid" | "usdc";

type AddFundsDialogProps = {
  onOpenChange: (open: boolean) => void;
  onSelect: (method: AddFundsMethod) => void;
  open: boolean;
  squidAvailable: boolean;
  squidDisabledReason?: string;
};

const cardBase = "group relative flex items-start gap-4 rounded-lg border p-4 text-left transition-colors";
const enabledCard = `${cardBase} hover:border-primary hover:bg-muted/50`;
const disabledCard = `${cardBase} border-dashed bg-muted/30`;
const iconEnabled = "mt-0.5 rounded-md bg-primary/10 p-2 text-primary";
const iconDisabled = "mt-0.5 rounded-md bg-muted p-2 text-muted-foreground";

type FundingMethodCardProps = {
  /** Replaces the arrow when the method is unavailable, e.g. "Testnet". */
  badge?: string;
  description: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
};

function FundingMethodCard({ badge, description, disabled = false, icon, label, onSelect }: FundingMethodCardProps) {
  return (
    <div className={disabled ? disabledCard : enabledCard}>
      {/* Stretched button keeps the whole card clickable without nesting
          interactive elements inside a <button>. */}
      <button
        aria-label={label}
        className={`absolute inset-0 rounded-lg ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        disabled={disabled}
        onClick={onSelect}
        type='button'
      />
      <span className={disabled ? iconDisabled : iconEnabled}>{icon}</span>
      <span className='flex-1'>
        <span className='flex items-center justify-between font-medium'>
          {label}
          {badge ? (
            <span className='rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground'>{badge}</span>
          ) : (
            <ArrowRight className='h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
          )}
        </span>
        <span className='mt-1 block text-sm text-muted-foreground'>{description}</span>
      </span>
    </div>
  );
}

export function AddFundsDialog({
  onOpenChange,
  onSelect,
  open,
  squidAvailable,
  squidDisabledReason,
}: AddFundsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>Add funds</DialogTitle>
          <DialogDescription>Choose how you want to fund your Filecoin Pay account.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-3'>
          <FundingMethodCard
            description='Already hold USDFC or another token on Filecoin? Deposit it directly.'
            icon={<Wallet className='h-5 w-5' />}
            label='Deposit token'
            onSelect={() => onSelect("deposit")}
          />
          {squidAvailable && (
            <FundingMethodCard
              description='Pay USDC from your Privy wallet or another wallet. It arrives as USDFC in your account, with nothing to sign on Filecoin.'
              icon={<Coins className='h-5 w-5' />}
              label='Fund with USDC'
              onSelect={() => onSelect("usdc")}
            />
          )}
          <FundingMethodCard
            badge={squidAvailable ? undefined : "Testnet"}
            description={
              squidAvailable ? (
                <>
                  Swap ETH, USDC and more from another chain into USDFC via{" "}
                  {/* `relative` lifts the link above the stretched button so it stays clickable. */}
                  <a
                    className='relative underline underline-offset-2'
                    href='https://app.squidrouter.com/'
                    rel='noopener noreferrer'
                    target='_blank'
                  >
                    Squid
                  </a>{" "}
                  to top up.
                </>
              ) : (
                (squidDisabledReason ?? "Available on Filecoin mainnet.")
              )
            }
            disabled={!squidAvailable}
            icon={<Repeat className='h-5 w-5' />}
            label='Swap to USDFC'
            onSelect={() => onSelect("squid")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
