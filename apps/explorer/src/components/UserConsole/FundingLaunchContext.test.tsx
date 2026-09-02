import { act, create } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { FundingLaunchProvider, useFundingLaunch } from "./FundingLaunchContext";

function Controls() {
  const { closeUsdcFunding, isUsdcFundingOpen, openUsdcFunding } = useFundingLaunch();
  return (
    <>
      <span data-open={isUsdcFundingOpen} />
      <button data-launch onClick={openUsdcFunding} type='button' />
      <button data-close onClick={closeUsdcFunding} type='button' />
    </>
  );
}

describe("FundingLaunchContext", () => {
  it("opens and closes the shared USDC funding dialog", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FundingLaunchProvider>
          <Controls />
        </FundingLaunchProvider>,
      );
    });
    expect(renderer.root.findByType("span").props["data-open"]).toBe(false);

    act(() => renderer.root.findByProps({ "data-launch": true }).props.onClick());
    expect(renderer.root.findByType("span").props["data-open"]).toBe(true);

    act(() => renderer.root.findByProps({ "data-close": true }).props.onClick());
    expect(renderer.root.findByType("span").props["data-open"]).toBe(false);
  });

  it("refuses to run outside the provider", () => {
    expect(() =>
      act(() => {
        create(<Controls />);
      }),
    ).toThrow("useFundingLaunch must be used within FundingLaunchProvider");
  });
});
