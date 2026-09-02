import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { FundingLaunchProvider, useFundingLaunch, useUsdcFundingLaunch } from "./FundingLaunchContext";

function Launcher() {
  const { launchUsdcFunding } = useFundingLaunch();
  return <button data-launch onClick={launchUsdcFunding} type='button' />;
}

function Listener({ onLaunch }: { onLaunch: () => void }) {
  useUsdcFundingLaunch(onLaunch);
  return null;
}

describe("FundingLaunchContext", () => {
  it("notifies listeners once per launch and not on mount", () => {
    const onLaunch = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FundingLaunchProvider>
          <Launcher />
          <Listener onLaunch={onLaunch} />
        </FundingLaunchProvider>,
      );
    });
    expect(onLaunch).not.toHaveBeenCalled();

    act(() => renderer.root.findByProps({ "data-launch": true }).props.onClick());
    act(() => renderer.root.findByProps({ "data-launch": true }).props.onClick());
    expect(onLaunch).toHaveBeenCalledTimes(2);
  });

  it("is a no-op for listeners rendered outside the provider", () => {
    const onLaunch = vi.fn();
    act(() => {
      create(<Listener onLaunch={onLaunch} />);
    });
    expect(onLaunch).not.toHaveBeenCalled();
  });
});
