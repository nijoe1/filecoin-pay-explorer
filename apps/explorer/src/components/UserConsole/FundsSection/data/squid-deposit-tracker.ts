import { type Address, type Hash, isAddress } from "viem";

const STORAGE_PREFIX = "filecoin-pay:squid-deposit:v1";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/** A broadcast Squid deposit route whose Filecoin Pay credit is still pending. */
export interface PendingSquidDeposit {
  recipient: Address;
  owner: Address;
  sourceChainId: number;
  quoteId: string;
  transactionHash: Hash;
  sourceAmount: bigint;
  minimumDestinationAmount: bigint;
  fundsBefore: bigint;
  startedAt: number;
}

export function getPendingSquidDepositKey(recipient: Address): string {
  return `${STORAGE_PREFIX}:${recipient.toLowerCase()}`;
}

export function savePendingSquidDeposit(storage: StorageLike, pending: PendingSquidDeposit): PendingSquidDeposit {
  storage.setItem(
    getPendingSquidDepositKey(pending.recipient),
    JSON.stringify({
      ...pending,
      sourceAmount: pending.sourceAmount.toString(),
      minimumDestinationAmount: pending.minimumDestinationAmount.toString(),
      fundsBefore: pending.fundsBefore.toString(),
    }),
  );
  return pending;
}

export function loadPendingSquidDeposit(storage: StorageLike, recipient: Address): PendingSquidDeposit | null {
  const value = storage.getItem(getPendingSquidDepositKey(recipient));
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.recipient !== "string" ||
      !isAddress(parsed.recipient) ||
      parsed.recipient.toLowerCase() !== recipient.toLowerCase() ||
      typeof parsed.owner !== "string" ||
      !isAddress(parsed.owner) ||
      typeof parsed.sourceChainId !== "number" ||
      !Number.isSafeInteger(parsed.sourceChainId) ||
      typeof parsed.quoteId !== "string" ||
      parsed.quoteId === "" ||
      typeof parsed.transactionHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(parsed.transactionHash) ||
      !isDigits(parsed.sourceAmount) ||
      !isDigits(parsed.minimumDestinationAmount) ||
      !isDigits(parsed.fundsBefore) ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    return {
      recipient: parsed.recipient,
      owner: parsed.owner,
      sourceChainId: parsed.sourceChainId,
      quoteId: parsed.quoteId,
      transactionHash: parsed.transactionHash as Hash,
      sourceAmount: BigInt(parsed.sourceAmount),
      minimumDestinationAmount: BigInt(parsed.minimumDestinationAmount),
      fundsBefore: BigInt(parsed.fundsBefore),
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function clearPendingSquidDeposit(storage: StorageLike, recipient: Address): void {
  storage.removeItem(getPendingSquidDepositKey(recipient));
}

function isDigits(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}
