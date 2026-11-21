/** Sent to a composer's input with the text to put in at the cursor: "@Name " or a bare "@" that opens the list. */
export const MENTION_INSERT_EVENT = "forge:mention-insert";

/**
 * Writes a project mention into the focused composer (else the main one) once no dialog is open: the
 * command palette and the context menu give the focus back while they close.
 */
export function insertMentionSoon(text: string, deadline = performance.now() + 1500) {
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) {
    if (performance.now() < deadline) requestAnimationFrame(() => insertMentionSoon(text, deadline));
    return;
  }
  setTimeout(() => {
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-composer]") ? document.activeElement : null;
    const el = focused ?? document.getElementById("composer-input");
    if (!el) return;
    el.focus();
    el.dispatchEvent(new CustomEvent(MENTION_INSERT_EVENT, { detail: text }));
  }, 30);
}

/** `insert` at the selection, with a space to a word in front of it; `caret` lands after it. */
export function insertMention(cur: string, from: number, to: number, insert: string): { text: string; caret: number } {
  const before = cur.slice(0, from);
  const after = cur.slice(to);
  const lead = before && !/\s$/.test(before) ? " " : "";
  return { text: before + lead + insert + after, caret: (before + lead + insert).length };
}
