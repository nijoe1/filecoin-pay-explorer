import { act, create } from "react-test-renderer";
import { maxUint256 } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServiceApprovalForm } from "./useServiceApprovalForm";

const SERVICE = "0x1111111111111111111111111111111111111111";
const USDFC = "0x3333333333333333333333333333333333333333";
const UNKNOWN = "0x4444444444444444444444444444444444444444";

const chain = vi.hoisted(() => ({
  data: undefined as { result: unknown }[] | undefined,
  isError: false,
  requests: [] as { contracts: unknown[]; query: { enabled: boolean } }[],
}));
vi.mock("wagmi", () => ({
  useReadContracts: (args: { contracts: unknown[]; query: { enabled: boolean } }) => {
    chain.requests.push(args);
    return { data: chain.data, isError: chain.isError };
  },
}));

let latest!: ReturnType<typeof useServiceApprovalForm>;
function Harness(props: Parameters<typeof useServiceApprovalForm>[0]) {
  latest = useServiceApprovalForm(props);
  return null;
}
const tokens = [{ decimals: 18n, id: USDFC, name: "USD for Filecoin Community", symbol: "USDFC" }];

async function render(props: Parameters<typeof useServiceApprovalForm>[0]) {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Harness {...props} />);
  });
  return renderer;
}

beforeEach(() => {
  chain.data = undefined;
  chain.isError = false;
  chain.requests = [];
});

describe("useServiceApprovalForm", () => {
  it("is complete once the service, a known token and a lockup period are in, with the limits in wei", async () => {
    await render({ open: true, services: [{ address: SERVICE, id: SERVICE }], tokens });
    expect(latest.isComplete).toBe(false);
    expect(latest.tokenStatus).toBe("empty");

    await act(async () => {
      latest.fields.setServiceInput(SERVICE);
      latest.fields.setTokenInput("usdfc");
      latest.fields.setLockupAllowance("10");
      latest.fields.setRateAllowance("0.5");
      latest.fields.setMaxLockupPeriod("30");
    });
    expect(latest.serviceAddress).toBe(SERVICE);
    expect(latest.tokenAddress).toBe(USDFC);
    expect(latest.tokenStatus).toBe("loaded");
    expect(latest.tokenDetails?.symbol).toBe("USDFC");
    expect(latest.lockupAllowanceWei).toBe(10n * 10n ** 18n);
    expect(latest.rateAllowanceWei).toBe(5n * 10n ** 17n);
    expect(latest.maxLockupEpochs).toBe(30n * 2880n);
    expect(latest.isComplete).toBe(true);
    expect(latest.review).toEqual({ lockupAllowance: "10", maxLockupPeriod: "30 days", rateAllowance: "0.5" });
    // An indexed token needs no chain read.
    expect(chain.requests.every((request) => !request.query.enabled)).toBe(true);

    await act(async () => {
      latest.fields.setIsUnlimited(true);
    });
    expect(latest.lockupAllowanceWei).toBe(maxUint256);
    expect(latest.review.rateAllowance).toBe("Unlimited");
  });

  it("reads an unknown token from the chain and reports how that goes", async () => {
    const renderer = await render({ open: true });
    await act(async () => {
      latest.fields.setTokenInput("0x12");
    });
    expect(latest.tokenStatus).toBe("invalid");

    await act(async () => {
      latest.fields.setTokenInput(UNKNOWN);
    });
    expect(latest.tokenStatus).toBe("loading");
    expect(chain.requests.at(-1)?.query.enabled).toBe(true);
    expect(chain.requests.at(-1)?.contracts).toHaveLength(3);

    chain.data = [{ result: "OTH" }, { result: 6 }, { result: "Other Coin" }];
    await act(async () => {
      renderer.update(<Harness open />);
    });
    expect(latest.tokenStatus).toBe("loaded");
    expect(latest.tokenDetails).toEqual({ decimals: 6, name: "Other Coin", symbol: "OTH" });

    chain.data = undefined;
    chain.isError = true;
    await act(async () => {
      renderer.update(<Harness open />);
    });
    expect(latest.tokenStatus).toBe("error");
    expect(latest.isComplete).toBe(false);
  });

  it("clears every field when the dialog closes", async () => {
    const renderer = await render({ open: true });
    await act(async () => {
      latest.fields.setServiceInput(SERVICE);
      latest.fields.setMaxLockupPeriod("7");
      latest.fields.setIsUnlimited(true);
    });
    await act(async () => {
      renderer.update(<Harness open={false} />);
    });
    expect(latest.fields.serviceInput).toBe("");
    expect(latest.fields.maxLockupPeriod).toBe("");
    expect(latest.fields.isUnlimited).toBe(false);
  });
});
