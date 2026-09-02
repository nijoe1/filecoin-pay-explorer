import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AccountNotFound from "./AccountNotFound";

const launch = vi.hoisted(() => ({ openUsdcFunding: vi.fn() }));

vi.mock("../FundingLaunchContext", () => ({ useFundingLaunch: () => launch }));
vi.mock("../DepositDialog", () => ({
  DepositDialog: ({ open }: { open: boolean }) => (open ? <div data-deposit-dialog /> : null),
}));
vi.mock("../DepositAndApproveDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-deposit-and-approve-dialog /> : null),
}));
vi.mock("../FundsSection/components", () => ({
  AddFundsDialog: ({
    onSelect,
    open,
    squidAvailable,
  }: {
    onSelect: (method: "deposit" | "squid" | "usdc") => void;
    open: boolean;
    squidAvailable: boolean;
  }) =>
    open ? (
      <div data-squid-available={squidAvailable}>
        <button aria-label='Choose deposit' onClick={() => onSelect("deposit")} type='button' />
        <button aria-label='Choose USDC funding' onClick={() => onSelect("usdc")} type='button' />
        <button aria-label='Choose Squid funding' onClick={() => onSelect("squid")} type='button' />
      </div>
    ) : null,
}));
vi.mock("@filecoin-foundation/ui-filecoin/Button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type='button'>
      {children}
    </button>
  ),
}));
vi.mock("@filecoin-foundation/ui-filecoin/EmptyStateCard", () => ({
  EmptyStateCard: ({ children, description, title }: { children: ReactNode; description: string; title: string }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

const buttonNamed = (renderer: ReturnType<typeof create>, label: string) =>
  renderer.root.find((node) => node.type === "button" && node.children.join("") === label);

describe("AccountNotFound", () => {
  it("leads with one Add funds action that opens the shared picker", async () => {
    const onGuidedTopUp = vi.fn();
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AccountNotFound onGuidedTopUp={onGuidedTopUp} />);
    });
    expect(renderer.root.findAllByType("button").map((button) => button.children.join(""))).toEqual([
      "Add funds",
      "Deposit and approve a service",
    ]);
    expect(renderer.root.findByType("p").children).toEqual(["Add funds to your account to start paying for services."]);

    await act(async () => buttonNamed(renderer, "Add funds").props.onClick());
    expect(renderer.root.findByProps({ "data-squid-available": true })).toBeDefined();

    await act(async () => renderer.root.findByProps({ "aria-label": "Choose USDC funding" }).props.onClick());
    expect(launch.openUsdcFunding).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByProps({ "data-squid-available": true })).toHaveLength(0);

    await act(async () => buttonNamed(renderer, "Add funds").props.onClick());
    await act(async () => renderer.root.findByProps({ "aria-label": "Choose Squid funding" }).props.onClick());
    expect(onGuidedTopUp).toHaveBeenCalledOnce();

    await act(async () => buttonNamed(renderer, "Add funds").props.onClick());
    await act(async () => renderer.root.findByProps({ "aria-label": "Choose deposit" }).props.onClick());
    expect(renderer.root.findAllByProps({ "data-deposit-dialog": true })).toHaveLength(1);

    await act(async () => buttonNamed(renderer, "Deposit and approve a service").props.onClick());
    expect(renderer.root.findAllByProps({ "data-deposit-and-approve-dialog": true })).toHaveLength(1);
  });

  it("offers the plain deposit only where Squid funding is unavailable", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AccountNotFound />);
    });
    await act(async () => buttonNamed(renderer, "Add funds").props.onClick());
    expect(renderer.root.findByProps({ "data-squid-available": false })).toBeDefined();
  });
});
