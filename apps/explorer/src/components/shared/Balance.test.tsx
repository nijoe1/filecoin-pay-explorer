import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Balance from "./Balance";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

const privy = vi.hoisted(() => ({
  authenticated: false,
  connectWallet: vi.fn(),
  exportWallet: vi.fn(),
  fundWithCard: vi.fn(async () => undefined),
  login: vi.fn(),
  logout: vi.fn(),
  onLoginComplete: undefined as (() => void) | undefined,
}));
const funding = vi.hoisted(() => ({ launchUsdcFunding: vi.fn() }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: ADDRESS }),
  useBalance: () => ({ data: { value: 0n }, isLoading: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useReadContract: () => ({ data: 0n, isLoading: false }),
  useWalletClient: () => ({ data: undefined }),
}));
vi.mock("@privy-io/react-auth", () => ({
  useConnectWallet: () => ({ connectWallet: privy.connectWallet }),
  useExportWallet: () => ({ exportWallet: privy.exportWallet }),
  useFiatOnramp: () => ({ fund: privy.fundWithCard }),
  useLogin: ({ onComplete }: { onComplete: () => void }) => {
    privy.onLoginComplete = onComplete;
    return { login: privy.login };
  },
  usePrivy: () => ({ authenticated: privy.authenticated, logout: privy.logout }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/useSynapse", () => ({
  default: () => ({ constants: { contracts: { usdfc: "0x2222222222222222222222222222222222222222" }, faucets: [] } }),
}));
vi.mock("@/components/UserConsole/FundingLaunchContext", () => ({ useFundingLaunch: () => funding }));
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
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type='button'>
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

beforeEach(() => {
  privy.authenticated = false;
  privy.onLoginComplete = undefined;
});

describe("Balance card purchases", () => {
  it("asks a connect-only wallet to log in, then continues the card purchase", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Balance />);
    });

    await act(async () => {
      menuItem(renderer, "Log in to buy with card").props.onClick();
    });
    expect(privy.login).toHaveBeenCalledOnce();
    expect(privy.fundWithCard).not.toHaveBeenCalled();

    await act(async () => {
      privy.onLoginComplete?.();
    });
    expect(privy.fundWithCard).toHaveBeenCalledWith({
      source: {},
      destination: { address: ADDRESS, chain: "eip155:8453", asset: BASE_USDC },
      environment: "production",
    });
    expect(funding.launchUsdcFunding).toHaveBeenCalledOnce();

    await act(async () => renderer.unmount());
  });

  it("buys with card directly once logged in", async () => {
    privy.authenticated = true;
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Balance />);
    });

    await act(async () => {
      menuItem(renderer, "Buy USDC with card").props.onClick();
    });
    expect(privy.login).not.toHaveBeenCalled();
    expect(privy.fundWithCard).toHaveBeenCalledOnce();

    await act(async () => renderer.unmount());
  });
});
