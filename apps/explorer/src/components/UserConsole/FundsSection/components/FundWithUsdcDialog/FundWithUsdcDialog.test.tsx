import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FundWithUsdcDialog } from "./FundWithUsdcDialog";

const RECIPIENT = "0x2222222222222222222222222222222222222222";
const EMBEDDED = "0x1111111111111111111111111111111111111111";
const EXTERNAL = "0x3333333333333333333333333333333333333333";

const privy = vi.hoisted(() => ({
  addFunds: vi.fn(),
  authenticated: true,
  login: vi.fn(),
  connectWallet: vi.fn(),
  fundWallet: vi.fn(),
  fundWithCard: vi.fn(),
  wallets: [] as { address: string; walletClientType: string }[],
}));
const topUpActivity = vi.hoisted(() => ({ setTopUpActive: vi.fn() }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: RECIPIENT }),
  usePublicClient: () => undefined,
}));
vi.mock("@privy-io/react-auth", () => ({
  useAddFunds: () => ({ addFunds: privy.addFunds }),
  useConnectWallet: () => ({ connectWallet: privy.connectWallet }),
  useFiatOnramp: () => ({ fund: privy.fundWithCard }),
  usePrivy: () => ({ authenticated: privy.authenticated, login: privy.login }),
  useFundWallet: () => ({ fundWallet: privy.fundWallet }),
  useWallets: () => ({ ready: true, wallets: privy.wallets }),
}));
const USDC_TOKENS = [
  { chainId: 8453, token: "0x4444444444444444444444444444444444444444", symbol: "USDC", decimals: 6 },
];
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "squid-usdc-tokens"
        ? USDC_TOKENS
        : queryKey[0] === "squid-deposit-balances"
          ? { token: 0n, native: 0n, gasPrice: 1n }
          : undefined,
    error: null,
    isError: false,
    isFetching: false,
    isPending: queryKey[0] !== "squid-usdc-tokens",
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("use-debounce", () => ({ useDebounce: (value: string) => [value] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/UserConsole/TopUpActivityContext", () => ({ useTopUpActivity: () => topUpActivity }));
vi.mock("@/components/UserConsole/TransactionReview", () => ({
  useTransactionReview: () => ({ requestReview: vi.fn(async () => true), reviewDialog: null }),
}));
vi.mock("@filecoin-foundation/ui-filecoin/Button", () => ({
  Button: ({
    "aria-label": ariaLabel,
    children,
    disabled,
    onClick,
  }: {
    "aria-label"?: string;
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button aria-label={ariaLabel} disabled={disabled} onClick={onClick} type='button'>
      {children}
    </button>
  ),
}));
vi.mock("@filecoin-foundation/ui-filecoin/Input", () => ({ Input: () => <input /> }));
vi.mock("@filecoin-pay/ui/components/label", () => ({
  Label: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@filecoin-pay/ui/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => children,
  DialogDescription: ({ children }: { children: ReactNode }) => children,
  DialogFooter: ({ children }: { children: ReactNode }) => children,
  DialogHeader: ({ children }: { children: ReactNode }) => children,
  DialogTitle: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@filecoin-pay/ui/components/select", () => ({
  Select: ({ children }: { children: ReactNode }) => children,
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ "aria-label": ariaLabel }: { "aria-label"?: string }) => (
    <button aria-label={ariaLabel} type='button' />
  ),
  SelectValue: () => null,
}));

beforeEach(() => {
  privy.authenticated = true;
  privy.wallets = [
    { address: EMBEDDED, walletClientType: "privy" },
    { address: EXTERNAL, walletClientType: "metamask" },
  ];
  vi.stubGlobal("window", { localStorage: { getItem: () => null, removeItem: vi.fn(), setItem: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FundWithUsdcDialog", () => {
  it("lists every connected wallet, offers to connect another, and holds the confirm until a quote exists", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FundWithUsdcDialog accountId='account' onOpenChange={() => undefined} open />);
    });

    // The source shows as a summary line until the user asks to change it.
    expect(renderer.root.findAllByType("option")).toHaveLength(0);
    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Change payment source" }).props.onClick();
    });
    const optionLabels = renderer.root.findAllByType("option").map((option) => option.props.children);
    expect(optionLabels).toContain("Privy wallet (0x1111...1111)");
    expect(optionLabels).toContain("Metamask (0x3333...3333)");
    expect(optionLabels).toContain("Base");

    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Connect another wallet" }).props.onClick();
    });
    expect(privy.connectWallet).toHaveBeenCalledOnce();

    expect(renderer.root.findByProps({ "aria-label": "Review payment" }).props.disabled).toBe(true);
    expect(renderer.root.findAllByProps({ "aria-label": "Pay with USDC" })).toHaveLength(0);
    // The embedded wallet is the default payer, so Privy's USDC funding is offered.
    expect(renderer.root.findAllByProps({ "aria-label": "Add USDC with Privy" }, { deep: false })).toHaveLength(1);
    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Buy USDC with card" }).props.onClick();
    });
    expect(privy.fundWithCard).toHaveBeenCalledWith({
      source: {},
      destination: { address: EMBEDDED, chain: "eip155:8453", asset: USDC_TOKENS[0].token },
      environment: "production",
    });
    expect(topUpActivity.setTopUpActive).toHaveBeenCalledWith(true);

    await act(async () => renderer.unmount());
  });

  it("asks a connect-only wallet to log in before buying USDC with card", async () => {
    privy.authenticated = false;
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FundWithUsdcDialog accountId='account' onOpenChange={() => undefined} open />);
    });

    expect(renderer.root.findAllByProps({ "aria-label": "Buy USDC with card" }, { deep: false })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-label": "Add USDC with Privy" }, { deep: false })).toHaveLength(0);
    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Log in to buy with card" }).props.onClick();
    });
    expect(privy.login).toHaveBeenCalledOnce();
    expect(privy.fundWithCard).not.toHaveBeenCalled();

    await act(async () => renderer.unmount());
  });
});
