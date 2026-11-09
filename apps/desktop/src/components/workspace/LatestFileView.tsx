import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen } from "lucide-react";
import type { Project } from "@forge/protocol";
import { contextItems } from "@/lib/context-menu";
import { call, keys } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { useSessionEvents } from "@/stores/session-events";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { CodeView, CodeViewSkeleton } from "@/components/ui/code-view";
import { EmptyState, ErrorBanner } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { fileIcon } from "./FileTree";
import { MediaPreview, NoPreview, mediaType } from "./FilePreview";
import { revealInProject } from "./file-links";
import { latestEditedFile, lineOfEdit, type LatestFile } from "./latest-file";
import { t } from "@/i18n";

const m = t.workspace.latestFile;
const MENU_ICON = "h-3.5 w-3.5";

/** The chat's "file" view: instead of the thread, the file Claude edited last, updated after each edit. */
export function LatestFileView({ project, sessionId, working, loading }: { project: Project; sessionId: string; working: boolean; loading: boolean }) {
  const events = useSessionEvents((s) => s.buffers[sessionId]?.events);
  const file = useMemo(() => latestEditedFile(events ?? [], project.path), [events, project.path]);

  if (loading)
    return (
      <SkeletonRegion label={m.loading} className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-2.5 w-48" />
        </div>
        <div className="min-h-0 flex-1">
          <CodeViewSkeleton />
        </div>
      </SkeletonRegion>
    );
  if (!file)
    return (
      <div className="min-h-0 flex-1 animate-view-in overflow-y-auto">
        <EmptyState icon={<FileText className="h-9 w-9" />} title={m.emptyTitle}>
          {m.emptyHint}
        </EmptyState>
      </div>
    );
  const [Icon, tone] = fileIcon(file.path);
  const editing = working && file.status === "editing";
  const reveal = () => void revealInProject(project.path, file.path);
  return (
    <div className="flex min-h-0 flex-1 animate-view-in flex-col">
      <div
        className="flex h-8 shrink-0 items-center gap-2 border-b border-border pl-3 pr-1"
        onContextMenu={contextItems(() => [
          { label: m.openInFiles, icon: <FileText className={MENU_ICON} />, onSelect: () => useUi.getState().openFile(project.id, file.path) },
          { label: t.workspace.files.reveal, icon: <FolderOpen className={MENU_ICON} />, onSelect: reveal },
        ])}
      >
        <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", tone)} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={file.path}>
          {file.path}
        </span>
        {editing && <span aria-hidden className="h-1.5 w-1.5 shrink-0 animate-soft-pulse rounded-full bg-accent" />}
        {editing && <span className="shrink-0 text-caption text-subtle">{m.editing}</span>}
        {file.status === "failed" && <span className="shrink-0 text-caption text-danger">{m.failed}</span>}
        <Button size="icon-sm" variant="ghost" onClick={reveal} aria-label={t.workspace.files.reveal} title={t.workspace.files.reveal}>
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FileBody key={file.path} project={project} file={file} editing={editing} onReveal={reveal} />
      </div>
    </div>
  );
}

/** The version in the key reads the file again after each finished edit; the old content stays until then. */
function FileBody({ project, file, editing, onReveal }: { project: Project; file: LatestFile; editing: boolean; onReveal: () => void }) {
  const media = mediaType(file.path);
  const q = useQuery({
    queryKey: [...keys.file(project.id, file.path), "latest", file.version],
    queryFn: () => call("projects.readFile", { projectId: project.id, path: file.path }),
    enabled: !media,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const content = q.data?.content;
  const line = useMemo(() => (content === undefined ? null : lineOfEdit(content, file.needle)), [content, file.needle]);
  if (media) return <MediaPreview key={file.version} projectId={project.id} path={file.path} kind={media.kind} mime={media.mime} />;
  if (q.isError)
    return editing ? (
      <EmptyState title={m.creating} />
    ) : (
      <div className="p-3">
        <ErrorBanner>{errorMessage(q.error)}</ErrorBanner>
      </div>
    );
  if (!q.data) return <CodeViewSkeleton />;
  if (q.data.binary) return <NoPreview path={file.path} onReveal={onReveal} />;
  return <CodeView path={file.path} content={q.data.content} truncated={q.data.truncated} line={line ?? undefined} jumpKey={file.version} />;
}
