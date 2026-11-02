const MAX_ENTRIES = 100;
const storageKey = (projectId: string) => `forge.composerHistory.${projectId}`;

function read(projectId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** What was sent in this project, newest first. Per project like the terminal, so it outlives a session. */
export function composerHistory(projectId: string): string[] {
  return read(projectId);
}

/** The palette asks the open composer to show the search. */
export const COMPOSER_HISTORY_EVENT = "forge:composer-history";

const MAX_MATCHES = 8;

/** Every word must appear, in any order and case; empty finds the newest. */
export function searchComposerHistory(projectId: string, query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return read(projectId)
    .filter((entry) => {
      const low = entry.toLowerCase();
      return words.every((w) => low.includes(w));
    })
    .slice(0, MAX_MATCHES);
}

export function rememberSent(projectId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const next = [t, ...read(projectId).filter((x) => x !== t)].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    /* full or blocked storage only costs the recall */
  }
}
