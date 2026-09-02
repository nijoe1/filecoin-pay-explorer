import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FundingLaunchProvider, useFundingLaunch } from "@/components/UserConsole/FundingLaunchContext";
import { UsdcFundingHost } from "./UsdcFundingHost";

const wallet = vi.hoisted(() => ({
  address: "0xABCDEF0000000000000000000000000000000001" as string | undefined,
  chainId: 314,
}));
const dialog = vi.hoisted(() => ({ onOpenChange: undefined as ((open: boolean) => void) | undefined }));

vi.mock("wagmi", () => ({ useConnection: () => wallet }));
vi.mock("./components", () => ({
  FundWithUsdcDialog: ({
    accountId,
    onOpenChange,
    open,
  }: {
    accountId: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) => {
    dialog.onOpenChange = onOpenChange;
    return <div data-account={accountId} data-usdc-dialog-open={open} />;
  },
}));

function Launcher() {
  const { openUsdcFunding } = useFundingLaunch();
  return <button data-launch onClick={openUsdcFunding} type='button' />;
}

function renderHost() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <FundingLaunchProvider>
        <Launcher />
        <UsdcFundingHost />
      </FundingLaunchProvider>,
    );
  });
  return renderer;
}

beforeEach(() => {
  wallet.address = "0xABCDEF0000000000000000000000000000000001";
  wallet.chainId = 314;
  dialog.onOpenChange = undefined;
});

describe("UsdcFundingHost", () => {
  it("renders the dialog once for the lowercase account and opens it on request", () => {
    const renderer = renderHost();
    expect(renderer.root.findAllByProps({ "data-usdc-dialog-open": false }, { deep: false })).toHaveLength(1);
    expect(renderer.root.findByType("div").props["data-account"]).toBe("0xabcdef0000000000000000000000000000000001");

    act(() => renderer.root.findByProps({ "data-launch": true }).props.onClick());
    expect(renderer.root.findByType("div").props["data-usdc-dialog-open"]).toBe(true);

    act(() => dialog.onOpenChange?.(false));
    expect(renderer.root.findByType("div").props["data-usdc-dialog-open"]).toBe(false);
  });

  it("renders nothing without an address or on calibration", () => {
    wallet.address = undefined;
    expect(renderHost().root.findAllByType("div")).toHaveLength(0);

    wallet.address = "0xABCDEF0000000000000000000000000000000001";
    wallet.chainId = 314159;
    expect(renderHost().root.findAllByType("div")).toHaveLength(0);
  });
});
