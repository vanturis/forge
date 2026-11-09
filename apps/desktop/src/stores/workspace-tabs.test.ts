import { describe, expect, it } from "vitest";
import { TMP_CHAT_TAG } from "@forge/protocol";
import { workspaceTabsFor } from "./ui";

describe("workspaceTabsFor", () => {
  it("leaves out Agenten, Git and Crew without git", () => {
    expect(workspaceTabsFor({ gitEnabled: false, tags: [] })).not.toContain("git");
  });

  it("offers only the chat in a temporary chat", () => {
    expect(workspaceTabsFor({ gitEnabled: false, tags: [TMP_CHAT_TAG] })).toEqual(["chat"]);
  });
});
