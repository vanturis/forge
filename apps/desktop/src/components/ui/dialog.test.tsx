import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  // jsdom has no layout. WebKit 17 collapses a flex-1 body inside the h-fit dialog to its padding (macOS).
  it("gives the body an auto flex basis", () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Titel">
        <p>Inhalt</p>
      </Dialog>,
    );
    const body = screen.getByText("Inhalt").parentElement!;
    expect(body.className).toContain("flex-auto");
    expect(body.className).not.toContain("flex-1");
  });
});
