import { Archive, ArchiveRestore } from "lucide-react";
import type { Session } from "@forge/protocol";
import { closeChatWindows } from "@/lib/chat-windows";
import { call, queryClient } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { isBusy } from "@/lib/working";
import { toast, useToasts } from "@/stores/toast";
import { useUi } from "@/stores/ui";
import type { MenuItem } from "@/components/ui/dropdown";
import { t } from "@/i18n";

type SessionRef = Pick<Session, "id" | "projectId" | "title">;

const MENU_ICON = "h-3.5 w-3.5";

/**
 * Puts a session into the archive. The lists follow through session.updated; here only its chat makes
 * room: a chat window closes and the workspace shows a new session instead of the archived one.
 */
export async function archiveSession(s: SessionRef): Promise<boolean> {
  const m = t.workspace.archive;
  try {
    await call("sessions.archive", { sessionId: s.id, archived: true });
  } catch (e) {
    toast.error(m.notArchived, errorMessage(e));
    return false;
  }
  closeChatWindows([s.id]);
  useUi.getState().forgetSessions([s.id]);
  void queryClient.invalidateQueries({ queryKey: ["allSessions"] });
  useToasts.getState().push({
    tone: "success",
    title: m.archived,
    body: m.archivedBody(s.title ?? m.untitled),
    action: { label: m.undo, onClick: () => void unarchiveSession(s) },
  });
  return true;
}

export async function unarchiveSession(s: SessionRef): Promise<boolean> {
  const m = t.workspace.archive;
  try {
    await call("sessions.archive", { sessionId: s.id, archived: false });
  } catch (e) {
    toast.error(m.notRestored, errorMessage(e));
    return false;
  }
  void queryClient.invalidateQueries({ queryKey: ["allSessions"] });
  toast.success(m.restored);
  return true;
}

/** A session that works or waits for an approval cannot go into the archive; the sidecar refuses it too. */
export function canArchive(s: Pick<Session, "archived" | "status" | "background">): boolean {
  return !s.archived && !isBusy(s.status) && s.background.length === 0;
}

/** "Archivieren" or "Aus dem Archiv holen" for menus; nothing while the session works. */
export function archiveMenuItems(s: SessionRef & Pick<Session, "archived" | "status" | "background">): MenuItem[] {
  const m = t.workspace.archive;
  if (s.archived) return [{ label: m.restore, icon: <ArchiveRestore className={MENU_ICON} />, onSelect: () => void unarchiveSession(s) }];
  if (!canArchive(s)) return [];
  return [{ label: m.archive, icon: <Archive className={MENU_ICON} />, onSelect: () => void archiveSession(s) }];
}
