import { type Address, isAddress, maxUint256, parseUnits } from "viem";

// The same words in every dialog that approves a service.
export const SERVICE_ADDRESS_PLACEHOLDER = "Service address (0x…)";
export const TOKEN_ADDRESS_PLACEHOLDER = "Token address (0x…)";
export const ALLOWANCE_PLACEHOLDER = "0.0";
export const LOCKUP_PERIOD_PLACEHOLDER = "e.g. 30";

/** The shape the subgraph's Operator and Token satisfy; the fields the pickers need. */
export type ServiceSuggestion = { address: string; id: string };
export type TokenSuggestion = { decimals: bigint | number | string; id: string; name: string; symbol: string };
export type TokenDetails = { decimals: number; name: string; symbol: string };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** A typed or picked service: any address, or a known service by its id or address. */
export function resolveServiceAddress(input: string, services: readonly ServiceSuggestion[]): Address | null {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return trimmed;
  const known = services.find((service) => same(service.address, trimmed) || same(service.id, trimmed));
  return known ? (known.id as Address) : null;
}

/** A typed or picked token: any address, or a known token by its id or symbol. */
export function resolveTokenAddress(input: string, tokens: readonly TokenSuggestion[]): Address | null {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return trimmed;
  const known = tokens.find((token) => same(token.id, trimmed) || same(token.symbol, trimmed));
  return known ? (known.id as Address) : null;
}

export function filterServices<T extends ServiceSuggestion>(services: readonly T[], input: string): T[] {
  const search = input.trim().toLowerCase();
  return services.filter(
    (service) => service.address.toLowerCase().includes(search) || service.id.toLowerCase().includes(search),
  );
}

export function filterTokens<T extends TokenSuggestion>(tokens: readonly T[], input: string): T[] {
  const search = input.trim().toLowerCase();
  return tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search) ||
      token.name.toLowerCase().includes(search) ||
      token.id.toLowerCase().includes(search),
  );
}

/** Details the account already indexed, so no chain read is needed. */
export function knownTokenDetails(tokens: readonly TokenSuggestion[], address: Address | null): TokenDetails | null {
  if (!address) return null;
  const known = tokens.find((token) => same(token.id, address));
  return known ? { decimals: Number(known.decimals), name: known.name, symbol: known.symbol } : null;
}

/** An allowance as the contract expects it: unlimited, the typed amount, or nothing. */
export function toAllowanceWei(value: string, decimals: number, isUnlimited: boolean): bigint {
  if (isUnlimited) return maxUint256;
  const trimmed = value.trim();
  return trimmed ? parseUnits(trimmed, decimals) : 0n;
}

/** How the review sheet names an allowance. */
export function describeAllowance(value: string, isUnlimited: boolean): string {
  return isUnlimited ? "Unlimited" : value.trim() || "0";
}
