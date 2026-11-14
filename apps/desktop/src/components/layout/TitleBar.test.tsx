import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ titleBar: false }));
vi.mock("@/lib/title-bar", async (original) => ({
  ...(await original<object>()),
  get hasTitleBar() {
    return state.titleBar;
  },
}));
vi.mock("./SyncButton", () => ({ SyncButton: () => <button>sync</button> }));
vi.mock("./AlwaysOnTopButton", () => ({ AlwaysOnTopButton: () => <button>pin</button> }));
vi.mock("./PhoneButton", () => ({ PhoneButton: () => <button>phone</button> }));
vi.mock("@/components/settings/SupportSettings", () => ({ SupportButton: () => <button>support</button> }));

import { useTitleBarSlot } from "@/lib/title-bar";
import { AppButtons } from "./Page";
import { InTitleBar } from "./TitleBar";

afterEach(() => {
  cleanup();
  state.titleBar = false;
  useTitleBarSlot.setState({ el: null });
});

describe("without FORGE's own title bar (macOS, Linux)", () => {
  it("keeps the layout switches and the app-wide buttons in the header", () => {
    render(
      <header>
        <InTitleBar>
          <button>toolbar</button>
        </InTitleBar>
        <AppButtons />
      </header>,
    );
    const header = screen.getByRole("banner");
    expect(header.textContent).toBe("toolbarsyncpinphone");
  });
});

describe("with FORGE's own title bar (Windows)", () => {
  it("moves the layout switches into the bar and leaves the app-wide buttons to it", () => {
    state.titleBar = true;
    const slot = document.createElement("div");
    document.body.append(slot);
    render(
      <header>
        <InTitleBar>
          <button>toolbar</button>
        </InTitleBar>
        <AppButtons divider />
      </header>,
    );
    // Nothing until the bar has mounted its slot, then the switches appear there.
    expect(screen.queryByText("toolbar")).toBeNull();
    act(() => useTitleBarSlot.setState({ el: slot }));
    expect(slot.textContent).toBe("toolbar");
    expect(screen.getByRole("banner").textContent).toBe("");
    slot.remove();
  });
});
