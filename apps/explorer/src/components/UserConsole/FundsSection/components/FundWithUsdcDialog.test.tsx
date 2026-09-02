import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeWallet,
  FundWithUsdcDialog,
  isFundingExit,
  isPrivyEmbeddedWallet,
  parseUsdcAmount,
  parseWalletChainId,
} from "./FundWithUsdcDialog";

const RECIPIENT = "0x2222222222222222222222222222222222222222";
const EMBEDDED = "0x1111111111111111111111111111111111111111";
const EXTERNAL = "0x3333333333333333333333333333333333333333";

const privy = vi.hoisted(() => ({
  addFunds: vi.fn(),
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
  usePrivy: () => ({ authenticated: true }),
  useFundWallet: () => ({ fundWallet: privy.fundWallet }),
  useWallets: () => ({ ready: true, wallets: privy.wallets }),
}));
const USDC_TOKENS = [
  { chainId: 8453, token: "0x4444444444444444444444444444444444444444", symbol: "USDC", decimals: 6 },
];
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "squid-usdc-tokens" ? USDC_TOKENS : undefined,
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
  privy.wallets = [
    { address: EMBEDDED, walletClientType: "privy" },
    { address: EXTERNAL, walletClientType: "metamask" },
  ];
  vi.stubGlobal("window", { localStorage: { getItem: () => null, removeItem: vi.fn(), setItem: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wallet helpers", () => {
  it("labels Privy embedded and external wallets", () => {
    expect(describeWallet({ address: EMBEDDED, walletClientType: "privy" })).toBe("Privy wallet (0x1111...1111)");
    expect(describeWallet({ address: EXTERNAL, walletClientType: "coinbase_wallet" })).toBe(
      "Coinbase Wallet (0x3333...3333)",
    );
    expect(isPrivyEmbeddedWallet({ walletClientType: "privy" })).toBe(true);
    expect(isPrivyEmbeddedWallet({ walletClientType: "metamask" })).toBe(false);
  });

  it("parses CAIP-2 chain ids and USDC amounts", () => {
    expect(parseWalletChainId("eip155:8453")).toBe(8453);
    expect(parseWalletChainId("eip155:nope")).toBeUndefined();
    expect(parseUsdcAmount("12.5", 6)).toBe(12_500_000n);
    expect(parseUsdcAmount("0", 6)).toBeNull();
    expect(parseUsdcAmount("abc", 6)).toBeNull();
    expect(parseUsdcAmount("", 6)).toBeNull();
  });

  it("treats a closed Privy funding modal as an exit rather than an error", () => {
    expect(isFundingExit(new Error("User exited the funding flow"))).toBe(true);
    expect(isFundingExit(undefined)).toBe(true);
    expect(isFundingExit(new Error("Funding is not enabled for this app"))).toBe(false);
  });
});

describe("FundWithUsdcDialog", () => {
  it("lists every connected wallet, offers to connect another, and holds the confirm until a quote exists", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<FundWithUsdcDialog accountId='account' onOpenChange={() => undefined} open />);
    });

    const optionLabels = renderer.root.findAllByType("option").map((option) => option.props.children);
    expect(optionLabels).toContain("Privy wallet (0x1111...1111)");
    expect(optionLabels).toContain("Metamask (0x3333...3333)");
    expect(optionLabels).toContain("Base");

    await act(async () => {
      renderer.root.findByProps({ "aria-label": "Connect another wallet" }).props.onClick();
    });
    expect(privy.connectWallet).toHaveBeenCalledOnce();

    expect(renderer.root.findByProps({ "aria-label": "Fund with USDC" }).props.disabled).toBe(true);
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
});
