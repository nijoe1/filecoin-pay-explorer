import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllowanceFields, LockupPeriodField, ServiceAddressField, TokenAddressField } from "./ServiceApprovalFields";
import { useServiceApprovalForm } from "./useServiceApprovalForm";

const SERVICE = "0x1111111111111111111111111111111111111111";
const USDFC = "0x3333333333333333333333333333333333333333";

vi.mock("wagmi", () => ({ useReadContracts: () => ({ data: undefined, isError: false }) }));
vi.mock("@filecoin-foundation/ui-filecoin/Badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@filecoin-foundation/ui-filecoin/Button", () => ({
  Button: ({
    "aria-label": ariaLabel,
    children,
    onClick,
  }: {
    "aria-label"?: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick} type='button'>
      {children}
    </button>
  ),
}));
vi.mock("@filecoin-foundation/ui-filecoin/Input", () => ({
  Input: ({
    disabled,
    id,
    onChange,
    onClick,
    onFocus,
    onKeyDown,
    placeholder,
    value,
  }: {
    disabled?: boolean;
    id: string;
    onChange: (value: string) => void;
    onClick?: () => void;
    onFocus?: () => void;
    onKeyDown?: (event: { key: string; stopPropagation: () => void }) => void;
    placeholder: string;
    value: string;
  }) => (
    <input
      data-set={onChange}
      disabled={disabled}
      id={id}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      readOnly
      value={value}
    />
  ),
}));
vi.mock("@filecoin-pay/ui/components/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

function Fields({ disabled = false, open = true }: { disabled?: boolean; open?: boolean }) {
  const form = useServiceApprovalForm({
    open,
    services: [{ address: SERVICE, id: SERVICE }],
    tokens: [{ decimals: 18n, id: USDFC, name: "USD for Filecoin Community", symbol: "USDFC" }],
  });
  return (
    <>
      <ServiceAddressField disabled={disabled} form={form} />
      <TokenAddressField disabled={disabled} form={form} />
      <AllowanceFields disabled={disabled} form={form} />
      <LockupPeriodField disabled={disabled} form={form} />
    </>
  );
}

async function render(props: Parameters<typeof Fields>[0] = {}) {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Fields {...props} />);
  });
  return renderer;
}
const input = (renderer: ReturnType<typeof create>, id: string) =>
  renderer.root.find((node) => node.type === "input" && node.props.id === id);
const flatten = (node: unknown): string =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(flatten).join("")
      : node && typeof node === "object" && "children" in node
        ? flatten((node as { children: unknown }).children)
        : "";
const text = (renderer: ReturnType<typeof create>) => flatten(renderer.toJSON());
const suggestionRows = (renderer: ReturnType<typeof create>) =>
  renderer.root.findAll((node) => node.type === "button" && node.props["aria-label"] === undefined);

// The suggestion list closes on a click outside, which needs a document to listen on.
beforeEach(() => {
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service approval fields", () => {
  it("uses the same placeholders wherever they appear", async () => {
    const renderer = await render();
    expect(input(renderer, "service-approval-service").props.placeholder).toBe("Service address (0x…)");
    expect(input(renderer, "service-approval-token").props.placeholder).toBe("Token address (0x…)");
    expect(input(renderer, "service-approval-lockup-allowance").props.placeholder).toBe("0.0");
    expect(input(renderer, "service-approval-rate-allowance").props.placeholder).toBe("0.0");
    expect(input(renderer, "service-approval-lockup-period").props.placeholder).toBe("e.g. 30");
  });

  it("offers the known services and tokens, fills the input on a pick, and validates what was typed", async () => {
    const renderer = await render();
    expect(renderer.root.findAllByProps({ "aria-label": "Show suggestions" }, { deep: false })).toHaveLength(2);

    // Focus alone, which a dialog gives its first field on open, shows no list; a click does.
    expect(input(renderer, "service-approval-service").props.onFocus).toBeUndefined();
    expect(suggestionRows(renderer)).toHaveLength(0);
    await act(async () => {
      input(renderer, "service-approval-service").props.onClick();
    });
    expect(suggestionRows(renderer)).toHaveLength(1);
    const pick = renderer.root.find(
      (node) =>
        node.type === "button" && node.findAllByType("span").some((span) => span.props.children === "0x1111...1111"),
    );
    await act(async () => {
      pick.props.onClick();
    });
    expect(input(renderer, "service-approval-service").props.value).toBe(SERVICE);
    expect(text(renderer)).toContain("Valid service address");

    await act(async () => {
      input(renderer, "service-approval-service").props["data-set"]("nope");
    });
    expect(text(renderer)).toContain("Invalid address format");

    await act(async () => {
      input(renderer, "service-approval-token").props["data-set"]("USDFC");
    });
    expect(text(renderer)).toContain("Token loaded");
    expect(text(renderer)).toContain("USD for Filecoin Community");
  });

  it("opens the list on ArrowDown and closes it on Escape without closing the dialog", async () => {
    const renderer = await render();
    const stopPropagation = vi.fn();
    await act(async () => {
      input(renderer, "service-approval-token").props.onKeyDown({ key: "ArrowDown", stopPropagation });
    });
    expect(suggestionRows(renderer)).toHaveLength(1);
    expect(stopPropagation).not.toHaveBeenCalled();
    await act(async () => {
      input(renderer, "service-approval-token").props.onKeyDown({ key: "Escape", stopPropagation });
    });
    expect(suggestionRows(renderer)).toHaveLength(0);
    expect(stopPropagation).toHaveBeenCalledOnce();
    // With no list open, Escape is left to the dialog.
    await act(async () => {
      input(renderer, "service-approval-token").props.onKeyDown({ key: "Escape", stopPropagation });
    });
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it("locks the allowance inputs behind the unlimited toggle", async () => {
    const renderer = await render();
    expect(input(renderer, "service-approval-lockup-allowance").props.disabled).toBe(false);
    await act(async () => {
      renderer.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } });
    });
    expect(input(renderer, "service-approval-lockup-allowance").props.disabled).toBe(true);
    expect(input(renderer, "service-approval-rate-allowance").props.disabled).toBe(true);
    expect(input(renderer, "service-approval-lockup-period").props.disabled).toBe(false);
  });
});
