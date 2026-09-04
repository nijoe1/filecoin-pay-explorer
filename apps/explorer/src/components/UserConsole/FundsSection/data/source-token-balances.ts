import { NATIVE_TOKEN_ADDRESS, type SourceToken } from "@filecoin-project/squid-evm-funding";
import { type Address, erc20Abi, type PublicClient } from "viem";

const BALANCE_BATCH_SIZE = 100;
const key = (address: string) => address.toLowerCase();

export type SourceTokenBalances = Readonly<Record<string, bigint | null>>;

export function sourceTokenCatalogIdentity(tokens: readonly SourceToken[]) {
  return [...new Set(tokens.map(({ token }) => key(token)))].sort().join(",");
}

export function sourceTokenBalancesQueryKey(owner: Address, chainId: number, tokens: readonly SourceToken[]) {
  return ["squid", "source-token-balances", owner, chainId, sourceTokenCatalogIdentity(tokens)] as const;
}

export function readSourceTokenBalance(
  client: Pick<PublicClient, "getBalance" | "readContract">,
  owner: Address,
  token: SourceToken,
) {
  if (key(token.token) === key(NATIVE_TOKEN_ADDRESS)) return client.getBalance({ address: owner });
  return client.readContract({
    abi: erc20Abi,
    address: token.token,
    args: [owner],
    functionName: "balanceOf",
  });
}

export async function readSourceTokenBalances(
  client: Pick<PublicClient, "getBalance" | "multicall">,
  owner: Address,
  tokens: readonly SourceToken[],
): Promise<SourceTokenBalances> {
  const uniqueTokens = [...new Map(tokens.map((token) => [key(token.token), token])).values()];
  const nativeToken = uniqueTokens.find((token) => key(token.token) === key(NATIVE_TOKEN_ADDRESS));
  const erc20Tokens = uniqueTokens.filter((token) => key(token.token) !== key(NATIVE_TOKEN_ADDRESS));
  const balances: Record<string, bigint | null> = {};
  const nativeBalance = nativeToken
    ? client.getBalance({ address: owner }).catch(() => null)
    : Promise.resolve<bigint | null>(null);

  for (let index = 0; index < erc20Tokens.length; index += BALANCE_BATCH_SIZE) {
    const batch = erc20Tokens.slice(index, index + BALANCE_BATCH_SIZE);
    try {
      const results = await client.multicall({
        allowFailure: true,
        contracts: batch.map((token) => ({
          abi: erc20Abi,
          address: token.token,
          args: [owner],
          functionName: "balanceOf" as const,
        })),
      });
      batch.forEach((token, resultIndex) => {
        const result = results[resultIndex];
        balances[key(token.token)] =
          result?.status === "success" && typeof result.result === "bigint" ? result.result : null;
      });
    } catch {
      batch.forEach((token) => {
        balances[key(token.token)] = null;
      });
    }
  }

  if (nativeToken) balances[key(nativeToken.token)] = await nativeBalance;
  return balances;
}

const COMMON_DECIMALS = 18n;
const isUsdc = (token: SourceToken) => token.symbol.toUpperCase() === "USDC";
/** Balances scaled to a common precision, so tokens with 6 and 18 decimals compare. */
const normalized = (balance: bigint, decimals: number) =>
  decimals <= 18
    ? balance * 10n ** (COMMON_DECIMALS - BigInt(decimals))
    : balance / 10n ** (BigInt(decimals) - COMMON_DECIMALS);

/** Plain USDC first, then catalog order. */
function usdcFirst(tokens: readonly SourceToken[]) {
  return [...tokens].sort((left, right) => Number(isUsdc(right)) - Number(isUsdc(left)));
}

export type SourceTokenSelection = {
  /** What the picker lists: the funded tokens, or the whole catalog when nothing is funded. */
  tokens: SourceToken[];
  /** True when the catalog is shown only to say what would be accepted; none of it can be paid with. */
  disabled: boolean;
};

/**
 * Only the tokens the wallet holds, USDC first and then largest balance first.
 * Until the balances are known the whole catalog is offered; once they are
 * known and nothing is funded, the catalog stays visible but greyed out.
 */
export function selectSourceTokens(
  tokens: readonly SourceToken[],
  balances: SourceTokenBalances | undefined,
): SourceTokenSelection {
  const catalog = usdcFirst(tokens);
  if (balances === undefined) return { tokens: catalog, disabled: false };
  const funded = catalog
    .filter((token) => (balances[key(token.token)] ?? 0n) > 0n)
    .sort((left, right) => {
      const byUsdc = Number(isUsdc(right)) - Number(isUsdc(left));
      if (byUsdc !== 0) return byUsdc;
      const leftBalance = normalized(balances[key(left.token)] ?? 0n, left.decimals);
      const rightBalance = normalized(balances[key(right.token)] ?? 0n, right.decimals);
      return rightBalance > leftBalance ? 1 : rightBalance < leftBalance ? -1 : 0;
    });
  if (funded.length > 0) return { tokens: funded, disabled: false };
  // Every read failed: the wallet may well hold something, so leave the catalog usable.
  const unknown = tokens.every((token) => balances[key(token.token)] == null);
  return { tokens: catalog, disabled: !unknown };
}

export function sourceTokenBalance(balances: SourceTokenBalances | undefined, token: string) {
  return balances?.[key(token)];
}
