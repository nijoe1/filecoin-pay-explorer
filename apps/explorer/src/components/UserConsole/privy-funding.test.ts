import { describe, expect, it, vi } from "vitest";
import {
  BASE_USDC,
  buildCardOnrampOptions,
  isFundingExit,
  isSandboxFlag,
  readOnrampEnvironment,
  toCaipChainId,
} from "./privy-funding";

describe("privy funding helpers", () => {
  it("builds card onramp options with a CAIP-2 chain and optional amount", () => {
    expect(
      buildCardOnrampOptions({ address: "0xabc", asset: BASE_USDC, chainId: 8453, environment: "production" }),
    ).toEqual({
      source: {},
      destination: { address: "0xabc", chain: "eip155:8453", asset: BASE_USDC },
      environment: "production",
    });
    expect(
      buildCardOnrampOptions({
        address: "0xabc",
        asset: BASE_USDC,
        chainId: 1,
        defaultAmount: "25",
        environment: "sandbox",
      }).defaultAmount,
    ).toBe("25");
    expect(toCaipChainId(314)).toBe("eip155:314");
  });

  it("treats a closed Privy modal as an exit rather than an error", () => {
    expect(isFundingExit(new Error("User exited the funding flow"))).toBe(true);
    expect(isFundingExit(undefined)).toBe(true);
    expect(isFundingExit(new Error("Funding is not enabled for this app"))).toBe(false);
  });

  it("reads the sandbox flag from the environment", () => {
    expect(isSandboxFlag("true")).toBe(true);
    expect(isSandboxFlag("1")).toBe(true);
    expect(isSandboxFlag("false")).toBe(false);
    expect(isSandboxFlag(undefined)).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ONRAMP_SANDBOX", "true");
    expect(readOnrampEnvironment()).toBe("sandbox");
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ONRAMP_SANDBOX", "");
    expect(readOnrampEnvironment()).toBe("production");
  });
});
