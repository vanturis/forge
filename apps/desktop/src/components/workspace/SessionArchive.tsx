import { useState } from "react";
import { Archive, ArchiveRestore, Eye, Trash2 } from "lucide-react";
import type { Session } from "@forge/protocol";
import { contextItems } from "@/lib/context-menu";
import { useArchivedSessions, useProjects } from "@/lib/queries";
import { relativeTime } from "@/lib/utils";
import { useSessionArchiveDialog } from "@/stores/session-archive";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorBanner, Tooltip } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { unarchiveSession } from "./session-archive";
import { t } from "@/i18n";

const MENU_ICON = "h-3.5 w-3.5";
const LIST = "divide-y divide-border overflow-hidden rounded-xl border border-border";

type ArchivedSession = Session & { projectName: string };

/** Mounted once in the main window: the archive the store asks for, of one project or of all. */
export function SessionArchiveDialogHost() {
  const m = t.workspace.archive;
  const { shown, projectId, close } = useSessionArchiveDialog();
  const projects = useProjects();
  const project = projectId ? projects.data?.find((p) => p.id === projectId) : null;
  return (
    <Dialog open={shown} onOpenChange={(o) => !o && close()} title={m.title} description={project ? m.descriptionProject(project.name) : m.descriptionAll} className="w-160">
      <ArchiveList projectId={projectId} enabled={shown} onLeave={close} />
    </Dialog>
  );
}

function ArchiveList({ projectId, enabled, onLeave }: { projectId: string | null; enabled: boolean; onLeave: () => void }) {
  const m = t.workspace.archive;
  const archive = useArchivedSessions(enabled);
  // Captured when the dialog opens: the row goes away with the session.
  const [deleting, setDeleting] = useState<ArchivedSession | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  if (archive.isPending) return <ArchiveSkeleton />;
  if (archive.isError) return <ErrorBanner>{m.loadFailed}</ErrorBanner>;
  const list = archive.data.filter((s) => !projectId || s.projectId === projectId);
  if (!list.length) {
    return (
      <EmptyState icon={<Archive className="h-7 w-7" />} title={m.empty}>
        {m.emptyHint}
      </EmptyState>
    );
  }

  const open = (s: ArchivedSession) => {
    useUi.getState().openProject(s.projectId, s.id);
    onLeave();
  };
  const restore = async (s: ArchivedSession) => {
    setRestoring(s.id);
    await unarchiveSession(s);
    setRestoring(null);
  };

  return (
    <>
      <div className="mb-2 text-caption text-subtle">{m.count(list.length)}</div>
      <ul className={LIST}>
        {list.map((s) => {
          const title = s.title ?? m.untitled;
          return (
            <li
              key={s.id}
              className="flex items-center gap-1 bg-surface py-1.5 pl-3 pr-2 hover:bg-surface-2"
              onContextMenu={contextItems(() => [
                { label: m.open, icon: <Eye className={MENU_ICON} />, onSelect: () => open(s) },
                { label: m.restore, icon: <ArchiveRestore className={MENU_ICON} />, onSelect: () => void restore(s) },
                { label: m.delete, icon: <Trash2 className={MENU_ICON} />, danger: true, onSelect: () => setDeleting(s) },
              ])}
            >
              <button className="min-w-0 flex-1 rounded-md py-0.5 text-left" onClick={() => open(s)} title={m.openOf(title)}>
                <span className="block truncate text-body">{title}</span>
                <span className="block truncate text-caption text-subtle">{projectId ? relativeTime(s.updatedAt) : `${s.projectName} · ${relativeTime(s.updatedAt)}`}</span>
              </button>
              <Tooltip content={m.open}>
                <Button size="icon-sm" variant="ghost" aria-label={m.openOf(title)} onClick={() => open(s)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content={m.restore}>
                <Button size="icon-sm" variant="ghost" aria-label={m.restoreOf(title)} loading={restoring === s.id} disabled={restoring !== null} onClick={() => void restore(s)}>
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content={m.delete}>
                <Button size="icon-sm" variant="ghost" aria-label={m.deleteOf(title)} className="hover:text-danger" onClick={() => setDeleting(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <DeleteSessionDialog session={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

/** The count line and four rows in the sizes of the real list. */
function ArchiveSkeleton() {
  return (
    <SkeletonRegion label={t.workspace.archive.loading}>
      <div className="mb-2 flex h-4 items-center">
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className={LIST}>
        {[56, 40, 64, 48].map((w) => (
          <div key={w} className="flex items-center gap-1 bg-surface py-1.5 pl-3 pr-2">
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 rounded-sm" style={{ width: `${w}%` }} />
              </div>
              <div className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-24 rounded-sm" />
              </div>
            </div>
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** In place of the composer of an archived session: the chat is read-only until it comes back. */
export function ArchivedBar({ session }: { session: Pick<Session, "id" | "projectId" | "title"> }) {
  const m = t.workspace.archive;
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    await unarchiveSession(session);
    setBusy(false);
  };
  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">
          <Archive className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-small font-medium">{m.barTitle}</div>
          <div className="text-caption-lg text-muted">{m.barBody}</div>
        </div>
        <Button size="sm" variant="primary" loading={busy} onClick={() => void restore()}>
          <ArchiveRestore className="h-3.5 w-3.5" /> {m.restore}
        </Button>
      </div>
    </div>
  );
}
