import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Balance from "./Balance";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const privy = vi.hoisted(() => ({
  authenticated: false,
  connectWallet: vi.fn(),
  exportWallet: vi.fn(),
  logout: vi.fn(),
}));
const funding = vi.hoisted(() => ({ openUsdcFunding: vi.fn() }));
const card = vi.hoisted(() => ({ buyWithCard: vi.fn(), label: "Log in to buy with card" }));
const wallet = vi.hoisted(() => ({ chainId: 314 }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: ADDRESS, chainId: wallet.chainId, connector: { name: "MetaMask" } }),
  useBalance: () => ({ data: { value: 0n }, isLoading: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useReadContract: () => ({ data: 0n, isLoading: false }),
  useWalletClient: () => ({ data: undefined }),
}));
vi.mock("@privy-io/react-auth", () => ({
  useConnectWallet: () => ({ connectWallet: privy.connectWallet }),
  useExportWallet: () => ({ exportWallet: privy.exportWallet }),
  usePrivy: () => ({ authenticated: privy.authenticated, logout: privy.logout, user: null }),
}));
vi.mock("@/hooks/useSynapse", () => ({
  default: () => ({ constants: { contracts: { usdfc: "0x2222222222222222222222222222222222222222" }, faucets: [] } }),
}));
vi.mock("@/components/UserConsole/FundingLaunchContext", () => ({ useFundingLaunch: () => funding }));
vi.mock("@/components/UserConsole/FundsSection/hooks/useCardPurchase", () => ({ useCardPurchase: () => card }));
vi.mock("@/components/UserConsole/TransactionReview", () => ({
  isReviewEnabled: () => false,
  setReviewEnabled: vi.fn(),
  useIsEmbeddedSigner: () => false,
}));
vi.mock("@filecoin-pay/ui/components/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button type='button'>{children}</button>,
}));
vi.mock("@filecoin-pay/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => children,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => children,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button data-menu-item onClick={onClick} type='button'>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => children,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
}));

const menuItem = (renderer: ReturnType<typeof create>, label: string) =>
  renderer.root.find(
    (node) => node.type === "button" && node.findAllByType("span").some((span) => span.props.children === label),
  );
const menuLabels = (renderer: ReturnType<typeof create>) =>
  renderer.root.findAllByProps({ "data-menu-item": true }).map((item) =>
    item
      .findAllByType("span")
      .map((span) => span.props.children)
      .find((c) => typeof c === "string"),
  );

async function render() {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Balance />);
  });
  return renderer;
}

beforeEach(() => {
  wallet.chainId = 314;
});

describe("Balance funding menu", () => {
  it("orders the menu as identity, funding, settings, then the way out", async () => {
    const renderer = await render();
    expect(JSON.stringify(renderer.toJSON())).toContain("MetaMask wallet");
    expect(menuLabels(renderer)).toEqual([
      "Copy address",
      "Add funds",
      "Log in to buy with card",
      "Connect another wallet",
      "Add USDFC to wallet",
      "Disconnect",
    ]);
    await act(async () => renderer.unmount());
  });

  it("opens the shared USDC payment from Add funds and buys with card through the shared hook", async () => {
    const renderer = await render();
    await act(async () => {
      menuItem(renderer, "Add funds").props.onClick();
    });
    expect(funding.openUsdcFunding).toHaveBeenCalledOnce();

    await act(async () => {
      menuItem(renderer, "Log in to buy with card").props.onClick();
    });
    expect(card.buyWithCard).toHaveBeenCalledOnce();
    await act(async () => renderer.unmount());
  });

  it("hides Add funds where USDC funding cannot deposit", async () => {
    wallet.chainId = 314159;
    const renderer = await render();
    expect(() => menuItem(renderer, "Add funds")).toThrow();
    await act(async () => renderer.unmount());
  });
});
