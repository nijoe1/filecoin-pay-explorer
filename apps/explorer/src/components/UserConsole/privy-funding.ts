import type { useFiatOnramp } from "@privy-io/react-auth";

/** Privy's card and exchange onramps deliver to Base; the funding dialog swaps it to USDFC. */
export const BASE_CHAIN_ID = 8453;
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export type FiatOnrampOptions = Parameters<ReturnType<typeof useFiatOnramp>["fund"]>[0];
export type OnrampEnvironment = NonNullable<FiatOnrampOptions["environment"]>;

export function toCaipChainId(chainId: number): `eip155:${number}` {
  return `eip155:${chainId}`;
}

/** Privy rejects its funding promise when the user simply closes the modal. */
export function isFundingExit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message === "" || /exit|clos|cancel|dismiss/i.test(message);
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
