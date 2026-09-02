import { Badge } from "@filecoin-foundation/ui-filecoin/Badge";
import { Button } from "@filecoin-foundation/ui-filecoin/Button";
import { Input } from "@filecoin-foundation/ui-filecoin/Input";
import { Label } from "@filecoin-pay/ui/components/label";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatAddress } from "@/utils/formatter";
import {
  ALLOWANCE_PLACEHOLDER,
  filterServices,
  filterTokens,
  LOCKUP_PERIOD_PLACEHOLDER,
  SERVICE_ADDRESS_PLACEHOLDER,
  TOKEN_ADDRESS_PLACEHOLDER,
} from "./service-approval-form";
import type { ServiceApprovalForm } from "./useServiceApprovalForm";

type FieldProps = { disabled: boolean; form: ServiceApprovalForm };

/** A text input that also offers a list to pick from, when there is one. */
function SuggestionInput<T>({
  disabled,
  id,
  onChange,
  onPick,
  placeholder,
  renderSuggestion,
  suggestionKey,
  suggestions,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  onPick: (suggestion: T) => string;
  placeholder: string;
  renderSuggestion: (suggestion: T) => ReactNode;
  suggestionKey: (suggestion: T) => string;
  suggestions: readonly T[];
  value: string;
}) {
  const [isOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  return (
    <div className='relative' ref={ref}>
      <Input
        className={suggestions.length > 0 ? "pr-10" : undefined}
        disabled={disabled}
        id={id}
        onChange={(next) => {
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        value={value}
      />
      {suggestions.length > 0 && (
        <Button
          aria-label='Show suggestions'
          className='absolute right-0 top-0 h-full px-3'
          disabled={disabled}
          onClick={() => setOpen((open) => !open)}
          size='compact'
          type='button'
          variant='ghost'
        >
          <ChevronDown className='h-4 w-4 text-muted-foreground' />
        </Button>
      )}
      {isOpen && suggestions.length > 0 && (
        <div className='absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md'>
          <div className='max-h-[200px] overflow-auto'>
            {suggestions.map((suggestion) => (
              <button
                className='w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent'
                key={suggestionKey(suggestion)}
                onClick={() => {
                  onChange(onPick(suggestion));
                  setOpen(false);
                }}
                type='button'
              >
                {renderSuggestion(suggestion)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_TONES = {
  destructive: { className: "text-destructive", Icon: AlertCircle },
  muted: { className: "text-muted-foreground", Icon: Loader2 },
  primary: { className: "text-primary", Icon: CheckCircle2 },
} as const;

function Status({ children, tone }: { children: ReactNode; tone: keyof typeof STATUS_TONES }) {
  const { className, Icon } = STATUS_TONES[tone];
  return (
    <div className={`mt-2 flex items-center gap-2 text-sm ${className}`}>
      <Icon className={tone === "muted" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      <span>{children}</span>
    </div>
  );
}

export function ServiceAddressField({ disabled, form }: FieldProps) {
  const { fields, serviceAddress, services } = form;
  return (
    <div className='grid gap-3'>
      <Label htmlFor='service-approval-service'>Service address</Label>
      <div>
        <SuggestionInput
          disabled={disabled}
          id='service-approval-service'
          onChange={fields.setServiceInput}
          onPick={(service) => service.id}
          placeholder={SERVICE_ADDRESS_PLACEHOLDER}
          renderSuggestion={(service) => (
            <span className='font-mono text-xs font-medium'>{formatAddress(service.address)}</span>
          )}
          suggestionKey={(service) => service.id}
          suggestions={filterServices(services, fields.serviceInput)}
          value={fields.serviceInput}
        />
        {fields.serviceInput.trim() !== "" &&
          (serviceAddress ? (
            <Status tone='primary'>Valid service address</Status>
          ) : (
            <Status tone='destructive'>Invalid address format</Status>
          ))}
      </div>
    </div>
  );
}

export function TokenAddressField({ disabled, form }: FieldProps) {
  const { fields, tokenDetails, tokens, tokenStatus } = form;
  return (
    <div className='grid gap-3'>
      <Label htmlFor='service-approval-token'>Token address</Label>
      <div>
        <SuggestionInput
          disabled={disabled}
          id='service-approval-token'
          onChange={fields.setTokenInput}
          onPick={(token) => token.id}
          placeholder={TOKEN_ADDRESS_PLACEHOLDER}
          renderSuggestion={(token) => (
            <span className='flex items-center justify-between'>
              <span>
                <span className='block font-medium'>{token.symbol}</span>
                <span className='block text-xs text-muted-foreground'>{token.name}</span>
              </span>
              <Badge variant='secondary'>{`${Number(token.decimals)} decimals`}</Badge>
            </span>
          )}
          suggestionKey={(token) => token.id}
          suggestions={filterTokens(tokens, fields.tokenInput)}
          value={fields.tokenInput}
        />
        {tokenStatus === "invalid" && <Status tone='destructive'>Invalid token address</Status>}
        {tokenStatus === "loading" && <Status tone='muted'>Loading token details…</Status>}
        {tokenStatus === "error" && <Status tone='destructive'>Failed to load token details</Status>}
        {tokenStatus === "loaded" && tokenDetails && (
          <div className='mt-2 grid gap-2 rounded-lg bg-primary/10 p-3'>
            <span className='flex items-center gap-2 text-sm font-medium text-primary'>
              <CheckCircle2 className='h-4 w-4' /> Token loaded
            </span>
            <dl className='grid grid-cols-2 gap-2 text-xs'>
              <div>
                <dt className='inline text-muted-foreground'>Symbol: </dt>
                <dd className='inline font-medium'>{tokenDetails.symbol}</dd>
              </div>
              <div>
                <dt className='inline text-muted-foreground'>Decimals: </dt>
                <dd className='inline font-medium'>{tokenDetails.decimals}</dd>
              </div>
              <div className='col-span-2'>
                <dt className='inline text-muted-foreground'>Name: </dt>
                <dd className='inline font-medium'>{tokenDetails.name}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

export function AllowanceFields({ disabled, form }: FieldProps) {
  const { fields } = form;
  const isLocked = disabled || fields.isUnlimited;
  return (
    <div className='grid gap-3'>
      <div className='flex items-center justify-between'>
        <Label>Allowances</Label>
        <label className='flex cursor-pointer items-center gap-2 text-sm'>
          <input
            checked={fields.isUnlimited}
            className='rounded'
            disabled={disabled}
            onChange={(event) => fields.setIsUnlimited(event.target.checked)}
            type='checkbox'
          />
          Unlimited
        </label>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='grid gap-2'>
          <Label className='text-xs text-muted-foreground' htmlFor='service-approval-lockup-allowance'>
            Lockup allowance
          </Label>
          <Input
            disabled={isLocked}
            id='service-approval-lockup-allowance'
            inputMode='decimal'
            onChange={fields.setLockupAllowance}
            placeholder={ALLOWANCE_PLACEHOLDER}
            type='text'
            value={fields.lockupAllowance}
          />
        </div>
        <div className='grid gap-2'>
          <Label className='text-xs text-muted-foreground' htmlFor='service-approval-rate-allowance'>
            Rate allowance
          </Label>
          <Input
            disabled={isLocked}
            id='service-approval-rate-allowance'
            inputMode='decimal'
            onChange={fields.setRateAllowance}
            placeholder={ALLOWANCE_PLACEHOLDER}
            type='text'
            value={fields.rateAllowance}
          />
        </div>
      </div>
    </div>
  );
}

export function LockupPeriodField({ disabled, form }: FieldProps) {
  const { fields } = form;
  return (
    <div className='grid gap-2'>
      <Label htmlFor='service-approval-lockup-period'>Max lockup period (days)</Label>
      <Input
        disabled={disabled}
        id='service-approval-lockup-period'
        inputMode='decimal'
        onChange={fields.setMaxLockupPeriod}
        placeholder={LOCKUP_PERIOD_PLACEHOLDER}
        type='text'
        value={fields.maxLockupPeriod}
      />
      <p className='text-xs text-muted-foreground'>The longest the service may keep your funds locked.</p>
    </div>
  );
}
