import type { Hash } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingSquidDeposit,
  getPendingSquidDepositKey,
  loadPendingSquidDeposit,
  type PendingSquidDeposit,
  savePendingSquidDeposit,
} from "./squid-deposit-tracker";

const RECIPIENT = "0x2222222222222222222222222222222222222222";
const pending: PendingSquidDeposit = {
  recipient: RECIPIENT,
  owner: "0x1111111111111111111111111111111111111111",
  sourceChainId: 8453,
  quoteId: "quote-1",
  transactionHash: `0x${"b".repeat(64)}` as Hash,
  sourceAmount: 100_000_000n,
  minimumDestinationAmount: 92n * 10n ** 18n,
  fundsBefore: 5n,
  startedAt: 1_700_000_000_000,
};

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => void items.delete(key),
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

describe("pending Squid deposit tracker", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("round-trips a pending deposit keyed by the recipient", () => {
    savePendingSquidDeposit(storage, pending);
    expect(storage.items.has(getPendingSquidDepositKey(RECIPIENT))).toBe(true);
    expect(loadPendingSquidDeposit(storage, RECIPIENT)).toEqual(pending);
    clearPendingSquidDeposit(storage, RECIPIENT);
    expect(loadPendingSquidDeposit(storage, RECIPIENT)).toBeNull();
  });

  it("ignores entries that are corrupt or belong to another account", () => {
    storage.setItem(getPendingSquidDepositKey(RECIPIENT), "{not json");
    expect(loadPendingSquidDeposit(storage, RECIPIENT)).toBeNull();

    savePendingSquidDeposit(storage, { ...pending, transactionHash: "0x1234" as Hash });
    expect(loadPendingSquidDeposit(storage, RECIPIENT)).toBeNull();

    savePendingSquidDeposit(storage, pending);
    expect(loadPendingSquidDeposit(storage, "0x9999999999999999999999999999999999999999")).toBeNull();
  });
});
