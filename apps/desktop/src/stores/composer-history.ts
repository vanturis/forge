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
