import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, FileText, FolderOpen, LocateFixed, X } from "lucide-react";
import type { Project } from "@forge/protocol";
import { contextItems } from "@/lib/context-menu";
import { call, keys, useSession } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { isBusy } from "@/lib/working";
import { useSessionEvents } from "@/stores/session-events";
import { splitActive, useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { CodeView, CodeViewSkeleton } from "@/components/ui/code-view";
import { EmptyState, ErrorBanner } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { useHistoryLoading } from "./ActivityFeed";
import { fileIcon } from "./FileTree";
import { MediaPreview, NoPreview, mediaType } from "./FilePreview";
import { revealInProject } from "./file-links";
import { lineOfEdit, liveFiles, type LiveFile } from "./live-files";
import { t } from "@/i18n";

const m = t.workspace.liveFiles;
const MENU_ICON = "h-3.5 w-3.5";

/** Beside the chat: the files of the open session, the one Claude edited last in front until the user picks another. */
export function LiveFilesPane({ project }: { project: Project }) {
  const sessionId = splitActive(useUi((s) => s.activeSession[project.id])).sessionId;
  const events = useSessionEvents((s) => (sessionId ? s.buffers[sessionId]?.events : undefined));
  const working = isBusy(useSession(sessionId).data?.status);
  const loading = useHistoryLoading(project.id);
  const close = useUi((s) => s.toggleLiveFiles);
  const files = useMemo(() => liveFiles(events ?? [], project.path), [events, project.path]);
  const [pinned, setPinned] = useState<{ sessionId: string | null; path: string } | null>(null);
  const pin = pinned?.sessionId === sessionId ? pinned.path : null;
  const current = files.find((f) => f.path === pin) ?? files[0] ?? null;
  const following = !pin;

  return (
    <section aria-label={m.title} className="flex w-1/2 shrink-0 animate-panel-in flex-col border-l border-border bg-sidebar">
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-border pl-3 pr-1">
        <Eye aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-body">{m.title}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-pressed={following}
          aria-label={m.follow}
          title={m.follow}
          disabled={!current}
          className={cn(following && "text-accent")}
          onClick={() => setPinned(following && current ? { sessionId, path: current.path } : null)}
        >
          <LocateFixed className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={m.close} title={m.close} onClick={() => close(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>
      {loading ? (
        <LiveFilesSkeleton />
      ) : !current ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title={m.emptyTitle}>
          {m.emptyHint}
        </EmptyState>
      ) : (
        <>
          <ul className="max-h-36 shrink-0 overflow-y-auto border-b border-border py-1">
            {files.map((f) => (
              <LiveFileRow key={f.path} file={f} project={project} working={working} active={f.path === current.path} onSelect={() => setPinned({ sessionId, path: f.path })} />
            ))}
          </ul>
          <div className="min-h-0 flex-1">
            <LiveFileView key={current.path} project={project} file={current} working={working} />
          </div>
        </>
      )}
    </section>
  );
}

function LiveFilesSkeleton() {
  return (
    <SkeletonRegion label={m.loading} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-0.5 border-b border-border py-1">
        {[45, 60, 35].map((w) => (
          <div key={w} className="flex h-6 items-center gap-2 px-3">
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
            <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <CodeViewSkeleton />
      </div>
    </SkeletonRegion>
  );
}

function LiveFileRow({ file, project, working, active, onSelect }: { file: LiveFile; project: Project; working: boolean; active: boolean; onSelect: () => void }) {
  const [Icon, tone] = fileIcon(file.path);
  const editing = working && file.status === "editing";
  const status = editing ? m.editing : file.status === "failed" ? m.failed : null;
  return (
    <li
      onContextMenu={contextItems(() => [
        { label: m.openInFiles, icon: <FileText className={MENU_ICON} />, onSelect: () => useUi.getState().openFile(project.id, file.path) },
        { label: t.workspace.files.reveal, icon: <FolderOpen className={MENU_ICON} />, onSelect: () => void revealInProject(project.path, file.path) },
      ])}
    >
      <button
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        title={file.path}
        className={cn("flex h-6 w-full items-center gap-2 px-3 text-left text-small-lg", active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
      >
        <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", tone)} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
        {editing && <span aria-hidden className="h-1.5 w-1.5 shrink-0 animate-soft-pulse rounded-full bg-accent" />}
        {status && <span className={cn("shrink-0 text-caption", file.status === "failed" ? "text-danger" : "text-subtle")}>{status}</span>}
      </button>
    </li>
  );
}

/** The version in the key reads the file again after each finished edit; the old content stays until then. */
function LiveFileView({ project, file, working }: { project: Project; file: LiveFile; working: boolean }) {
  const media = mediaType(file.path);
  const q = useQuery({
    queryKey: [...keys.file(project.id, file.path), "live", file.version],
    queryFn: () => call("projects.readFile", { projectId: project.id, path: file.path }),
    enabled: !media,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const content = q.data?.content;
  const line = useMemo(() => (content === undefined ? null : lineOfEdit(content, file.needle)), [content, file.needle]);
  if (media) return <MediaPreview key={file.version} projectId={project.id} path={file.path} kind={media.kind} mime={media.mime} />;
  if (q.isError)
    return working && file.status === "editing" ? (
      <EmptyState title={m.creating} />
    ) : (
      <div className="p-3">
        <ErrorBanner>{errorMessage(q.error)}</ErrorBanner>
      </div>
    );
  if (!q.data) return <CodeViewSkeleton />;
  if (q.data.binary) return <NoPreview path={file.path} onReveal={() => void revealInProject(project.path, file.path)} />;
  return <CodeView path={file.path} content={q.data.content} truncated={q.data.truncated} line={line ?? undefined} jumpKey={file.version} />;
}
