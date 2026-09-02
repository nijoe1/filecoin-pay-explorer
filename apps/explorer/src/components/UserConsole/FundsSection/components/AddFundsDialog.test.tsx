import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { AddFundsDialog } from "./AddFundsDialog";

vi.mock("@filecoin-pay/ui/components/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogDescription: ({ children }: { children: React.ReactNode }) => children,
  DialogHeader: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}));

describe("AddFundsDialog", () => {
  it("names every funding action by what it does and preserves their selection values", () => {
    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<AddFundsDialog onOpenChange={() => undefined} onSelect={onSelect} open squidAvailable />);
    });

    const deposit = renderer.root.findByProps({ "aria-label": "Deposit token" });
    const usdc = renderer.root.findByProps({ "aria-label": "Fund with USDC" });
    const swap = renderer.root.findByProps({ "aria-label": "Swap to USDFC" });
    const visibleText = renderer.root.findAllByType("span").flatMap((node) => node.children);
    expect(visibleText).toContain("Deposit token");
    expect(visibleText).toContain("Fund with USDC");
    expect(visibleText).toContain("Swap to USDFC");
    expect(visibleText).toContain("Already hold USDFC or another token on Filecoin? Deposit it directly.");

    act(() => deposit.props.onClick());
    act(() => usdc.props.onClick());
    act(() => swap.props.onClick());
    expect(onSelect.mock.calls).toEqual([["deposit"], ["usdc"], ["squid"]]);
  });
});

describe("AddFundsDialog without Squid", () => {
  it("hides the USDC route when Squid funding is unavailable", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AddFundsDialog onOpenChange={() => undefined} onSelect={() => undefined} open squidAvailable={false} />,
      );
    });
    expect(renderer.root.findAllByProps({ "aria-label": "Fund with USDC" })).toHaveLength(0);
  });
});
