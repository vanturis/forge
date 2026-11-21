import { Fragment, useMemo, type ReactNode } from "react";
import { AtSign, Copy, FolderOpen, FolderSearch } from "lucide-react";
import { findProjectMentions, mentionable, type ProjectMention, type ProjectWithStatus } from "@forge/protocol";
import { useProjects } from "@/lib/queries";
import { contextItems, copyText } from "@/lib/context-menu";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import { Kbd } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { revealPath } from "./file-links";
import { withUltrathink } from "./ultrathink";
import { t } from "@/i18n";

const NONE: ProjectWithStatus[] = [];

/** The other projects a chat of `projectId` can refer to with "@Name", last opened first. */
export function useMentionTargets(projectId: string | null): { list: ProjectWithStatus[]; loading: boolean } {
  const projects = useProjects();
  const list = useMemo(() => {
    const all = projects.data;
    if (!all) return NONE;
    const current = all.find((p) => p.id === projectId) ?? null;
    return mentionable(all, current).sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""));
  }, [projects.data, projectId]);
  return { list, loading: projects.isLoading };
}

/** The text in parts: `mention` renders each "@Name", the rest keeps the ultrathink colors. */
export function withMentions(text: string, mentions: ProjectMention[], mention: (label: string, m: ProjectMention) => ReactNode): ReactNode {
  if (!mentions.length) return withUltrathink(text);
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of mentions) {
    if (m.start > at) out.push(<Fragment key={`t${at}`}>{withUltrathink(text.slice(at, m.start))}</Fragment>);
    out.push(<Fragment key={`m${m.start}`}>{mention(text.slice(m.start, m.end), m)}</Fragment>);
    at = m.end;
  }
  if (at < text.length) out.push(<Fragment key={`t${at}`}>{withUltrathink(text.slice(at))}</Fragment>);
  return out;
}

/**
 * For the copy behind the composer's field: only color, nothing that changes the width of a letter,
 * or the copy would no longer line up with what is typed.
 */
export function composerMention(label: string): ReactNode {
  return <span className="rounded-sm bg-accent-soft text-accent">{label}</span>;
}

/** A sent message with its project mentions as links to the project. */
export function MentionedText({ text, projectId }: { text: string; projectId: string | null }) {
  const { list } = useMentionTargets(projectId);
  const mentions = useMemo(() => findProjectMentions(text, list), [text, list]);
  const parts = withMentions(text, mentions, (label, m) => {
    const p = list.find((x) => x.id === m.projectId);
    if (!p) return label;
    return (
      <button
        type="button"
        title={t.chat.mention.title(p.name, p.path)}
        onClick={() => useUi.getState().openProject(p.id)}
        onContextMenu={contextItems(() => [
          { label: t.chat.mention.open, icon: <FolderOpen className="h-3.5 w-3.5" />, onSelect: () => useUi.getState().openProject(p.id) },
          { label: t.projects.card.showInExplorer, icon: <FolderSearch className="h-3.5 w-3.5" />, onSelect: () => void revealPath(p.path) },
          { label: t.projects.card.copyPath, icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => copyText(p.path) },
        ])}
        className="rounded-sm bg-accent-soft px-1 text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        {label}
      </button>
    );
  });
  return <>{parts}</>;
}

const SKELETON_ROWS = 3;

/** Projects above the composer while an "@…" is typed. */
export function ProjectMentionMenu({ matches, loading, index, onPick }: { matches: ProjectWithStatus[]; loading: boolean; index: number; onPick: (project: ProjectWithStatus) => void }) {
  if (!matches.length && !loading) return null;
  return (
    <div className="absolute bottom-full left-6 right-6 z-20 mb-1 animate-rise-in overflow-hidden rounded-lg border border-border bg-surface-2 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 text-caption text-subtle">
        <span className="flex min-w-0 items-center gap-1.5">
          <AtSign className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t.chat.mention.hint}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Kbd>Tab</Kbd> {t.chat.mention.accept}
          <span aria-hidden>·</span>
          <Kbd>Esc</Kbd> {t.chat.mention.hide}
        </span>
      </div>
      {loading ? (
        <SkeletonRegion label={t.chat.mention.loading}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className="box-content flex h-[1.5em] items-center gap-3 px-3 py-1.5 text-small-lg">
              <Skeleton className="h-3 w-24 shrink-0 rounded-sm bg-surface-3" />
              <Skeleton className="h-2.5 rounded-sm bg-surface-3" style={{ width: `${45 - i * 10}%` }} />
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <div role="listbox" aria-label={t.chat.mention.label}>
          {matches.map((p, i) => (
            <button
              key={p.id}
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
              }}
              className={cn("flex w-full items-baseline gap-3 px-3 py-1.5 text-left", i === index ? "bg-surface-3" : "hover:bg-surface-3")}
            >
              <span className="shrink-0 text-small-lg font-medium text-accent">@{p.name}</span>
              {p.group && <span className="shrink-0 text-caption text-subtle">{p.group}</span>}
              <span className="min-w-0 truncate text-xs text-muted">{p.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
