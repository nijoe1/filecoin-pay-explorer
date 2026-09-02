import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountNotFound from "./AccountNotFound";

const launch = vi.hoisted(() => ({ openAddFunds: vi.fn() }));

vi.mock("../FundingLaunchContext", () => ({ useFundingLaunch: () => launch }));
vi.mock("../DepositAndApproveDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-deposit-and-approve-dialog /> : null),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountNotFound", () => {
  it("leads with one Add funds action that the funding host answers, beside deposit and approve", async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AccountNotFound />);
    });
    expect(renderer.root.findAllByType("button").map((button) => button.children.join(""))).toEqual([
      "Add funds",
      "Deposit and approve a service",
    ]);
    expect(renderer.root.findByType("p").children).toEqual(["Add funds to your account to start paying for services."]);

    await act(async () => buttonNamed(renderer, "Add funds").props.onClick());
    // No token is named: a new account has nothing indexed to open the deposit on.
    expect(launch.openAddFunds).toHaveBeenCalledExactlyOnceWith();
    expect(renderer.root.findAllByProps({ "data-deposit-and-approve-dialog": true })).toHaveLength(0);

    await act(async () => buttonNamed(renderer, "Deposit and approve a service").props.onClick());
    expect(renderer.root.findAllByProps({ "data-deposit-and-approve-dialog": true })).toHaveLength(1);
  });
});
