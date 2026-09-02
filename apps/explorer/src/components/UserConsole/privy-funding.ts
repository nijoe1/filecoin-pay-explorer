import type { useFiatOnramp } from "@privy-io/react-auth";
import { toast } from "sonner";

/** Privy's card and exchange onramps deliver to Base by default; the funding dialog swaps it to USDFC. */
export const BASE_CHAIN_ID = 8453;
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/**
 * Where a card purchase can land and still be paid into the account: the EVM
 * networks Privy's fiat onramp delivers USDC on (Base, Ethereum, Arbitrum,
 * Polygon; Solana and Tempo are not Squid sources), all of which Squid can
 * bridge from. Source: https://docs.privy.io/wallets/funding/fiat-onramp
 */
export const CARD_ONRAMP_CHAIN_IDS: readonly number[] = [BASE_CHAIN_ID, 1, 42161, 137];

export type FiatOnrampOptions = Parameters<ReturnType<typeof useFiatOnramp>["fund"]>[0];
export type OnrampEnvironment = NonNullable<FiatOnrampOptions["environment"]>;

export function toCaipChainId(chainId: number): `eip155:${number}` {
  return `eip155:${chainId}`;
}

/**
 * The messages Privy rejects with when the user leaves a funding modal:
 * "User exited flow", "User exited the modal before submitting the
 * transaction", "sdk_deposit_address_exited", "Verification canceled",
 * "cancelled", "User rejected the request." Anything else is a real failure.
 */
const FUNDING_EXIT_MESSAGES = [/^user exited\b/i, /_exited$/i, /\bcancell?ed$/i, /^user rejected\b/i];
const USER_REJECTED_REQUEST_CODE = 4001;

/** Whether a rejected Privy funding promise only means the user closed the modal. */
export function isFundingExit(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && error.code === USER_REJECTED_REQUEST_CODE) {
    return true;
  }
  const message = (error instanceof Error ? error.message : typeof error === "string" ? error : "").trim();
  return message === "" || FUNDING_EXIT_MESSAGES.some((pattern) => pattern.test(message));
}

/**
 * Runs a Privy funding modal (card, transfer picker, gas) and reports whether it
 * completed. The user closing the modal is not an error; anything else is
 * shown as a toast under `unavailableTitle`.
 */
export async function runPrivyFunding(
  flow: () => Promise<unknown>,
  {
    fallbackDescription = "Enable funding in the Privy dashboard.",
    unavailableTitle,
  }: {
    fallbackDescription?: string;
    unavailableTitle: string;
  },
): Promise<boolean> {
  try {
    await flow();
    return true;
  } catch (error) {
    if (!isFundingExit(error)) {
      toast.error(unavailableTitle, { description: error instanceof Error ? error.message : fallbackDescription });
    }
    return false;
  }
}

export function isSandboxFlag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

/**
 * `NEXT_PUBLIC_PRIVY_ONRAMP_SANDBOX=true` routes card purchases to the
 * providers' sandboxes, where Privy's test card 4242 4242 4242 4242 works.
 * The value is inlined at build time, so it is read as a literal here.
 */
export function readOnrampEnvironment(): OnrampEnvironment {
  return isSandboxFlag(process.env.NEXT_PUBLIC_PRIVY_ONRAMP_SANDBOX) ? "sandbox" : "production";
}

/** Card purchase of a token delivered to `address`; the fiat currency follows the user's region. */
export function buildCardOnrampOptions({
  address,
  asset,
  chainId,
  defaultAmount,
  environment,
}: {
  address: string;
  asset: string;
  chainId: number;
  defaultAmount?: string;
  environment: OnrampEnvironment;
}): FiatOnrampOptions {
  return {
    source: {},
    destination: { address, chain: toCaipChainId(chainId), asset },
    environment,
    ...(defaultAmount ? { defaultAmount } : {}),
  };
}
