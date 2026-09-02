import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import {
  describeAllowance,
  filterServices,
  filterTokens,
  knownTokenDetails,
  resolveServiceAddress,
  resolveTokenAddress,
  toAllowanceWei,
} from "./service-approval-form";

const SERVICE = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const USDFC = "0x3333333333333333333333333333333333333333";
const services = [{ address: SERVICE, id: SERVICE }];
const tokens = [
  { decimals: 18n, id: USDFC, name: "USD for Filecoin Community", symbol: "USDFC" },
  { decimals: 6n, id: OTHER, name: "Other Coin", symbol: "OTH" },
];

describe("resolving what was typed or picked", () => {
  it("accepts any address, a known service, and nothing else", () => {
    expect(resolveServiceAddress(` ${OTHER} `, services)).toBe(OTHER);
    expect(resolveServiceAddress(SERVICE.toUpperCase().replace("0X", "0x"), services)).toBe(SERVICE);
    expect(resolveServiceAddress("not an address", services)).toBeNull();
    expect(resolveServiceAddress("", services)).toBeNull();
  });

  it("accepts a token by address or symbol, in any case", () => {
    expect(resolveTokenAddress("usdfc", tokens)).toBe(USDFC);
    expect(resolveTokenAddress(OTHER, [])).toBe(OTHER);
    expect(resolveTokenAddress("0x12", tokens)).toBeNull();
  });
});

describe("suggestions", () => {
  it("filters services by address and tokens by symbol, name or address", () => {
    expect(filterServices(services, "0x11")).toEqual(services);
    expect(filterServices(services, "0x22")).toEqual([]);
    expect(filterTokens(tokens, "other").map((t) => t.symbol)).toEqual(["OTH"]);
    expect(filterTokens(tokens, "USD").map((t) => t.symbol)).toEqual(["USDFC"]);
    expect(filterTokens(tokens, "").map((t) => t.symbol)).toEqual(["USDFC", "OTH"]);
  });

  it("reads details from an indexed token without a chain call", () => {
    expect(knownTokenDetails(tokens, USDFC)).toEqual({
      decimals: 18,
      name: "USD for Filecoin Community",
      symbol: "USDFC",
    });
    expect(knownTokenDetails(tokens, SERVICE)).toBeNull();
    expect(knownTokenDetails(tokens, null)).toBeNull();
  });
});

describe("allowances", () => {
  it("turns the typed amount into wei, nothing into zero and the toggle into unlimited", () => {
    expect(toAllowanceWei("1.5", 6, false)).toBe(1_500_000n);
    expect(toAllowanceWei("  ", 6, false)).toBe(0n);
    expect(toAllowanceWei("1.5", 6, true)).toBe(maxUint256);
  });

  it("describes an allowance for the review sheet", () => {
    expect(describeAllowance("12", false)).toBe("12");
    expect(describeAllowance("", false)).toBe("0");
    expect(describeAllowance("12", true)).toBe("Unlimited");
  });
});
