import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, LogIn, LogOut, Pencil, Plus, RefreshCw, Server, ShieldCheck, Trash2 } from "lucide-react";
import type { McpServer } from "@forge/protocol";
import { call } from "@/lib/queries";
import { contextItems, copyText } from "@/lib/context-menu";
import { errorMessage } from "@/lib/rpc";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/input";
import { Badge, EmptyState, ErrorBanner, SectionTitle, Tooltip } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { McpLoginButton, startMcpLogin } from "./McpLogin";
import { McpServerDialog } from "./McpServerDialog";
import { authSummary, MCP_STATUS, MCP_STATUS_TONE, mcpScopeLabel, mcpScopeOptions, mcpStatusText, type McpScope } from "./mcp";
import { t } from "@/i18n";

const m = t.extensions.mcpTab;

/** "plugin:stripe:stripe" is "stripe", "claude.ai Trello" is "Trello"; the badge next to it says where it comes from. */
export function shownName(s: Pick<McpServer, "name" | "origin">): string {
  if (s.origin === "plugin") return s.name.split(":").at(-1) ?? s.name;
  if (s.origin === "claude.ai") return s.name.replace(/^claude\.ai\s+/, "");
  return s.name;
}

export function McpTab({ projectId }: { projectId?: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["mcp", projectId ?? "global"], queryFn: () => call("mcp.list", { projectId }), staleTime: 60_000, refetchOnMount: "always" });
  const [dialog, setDialog] = useState<{ edit: string | null } | null>(null);
  const [removing, setRemoving] = useState<McpServer | null>(null);
  // Only for servers whose config file FORGE did not find: then the user picks the scope.
  const [scope, setScope] = useState<McpScope>("user");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["mcp"] });

  const approve = async (s: McpServer) => {
    if (!projectId) return;
    try {
      await call("mcp.approve", { projectId, name: s.name });
      toast.success(m.approved, s.name);
      refresh();
    } catch (e) {
      toast.error(m.notApproved, errorMessage(e));
    }
  };
  const canApprove = (s: McpServer) => s.status === "pending" && s.scope === "project" && !!projectId;
  const askRemove = (s: McpServer) => {
    setScope(s.scope ?? "user");
    setRemoving(s);
  };
  const signOut = async (s: McpServer) => {
    try {
      await call("mcp.logout", { projectId, name: s.name });
      toast.success(m.signedOut(shownName(s)));
    } catch (e) {
      toast.error(m.notSignedOut(shownName(s)), errorMessage(e));
    }
  };
  const menu = (s: McpServer) => [
    ...(s.status === "needs_auth" ? [{ label: m.login.signIn, icon: <LogIn className="h-3.5 w-3.5" />, onSelect: () => void startMcpLogin(s.name, projectId) }] : []),
    ...(s.remote && s.status === "connected" && !s.headerNames?.length ? [{ label: m.signOut, icon: <LogOut className="h-3.5 w-3.5" />, onSelect: () => void signOut(s) }] : []),
    ...(canApprove(s) ? [{ label: m.approve, icon: <ShieldCheck className="h-3.5 w-3.5" />, onSelect: () => void approve(s) }] : []),
    ...(s.scope ? [{ label: m.editLabel, icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => setDialog({ edit: s.name }) }] : []),
    { label: m.copyName, icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => copyText(s.name) },
    ...(s.origin ? [] : [{ label: m.remove(s.name), icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => askRemove(s) }]),
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <SectionTitle
        action={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => void list.refetch()} loading={list.isFetching}>
              <RefreshCw className="h-3.5 w-3.5" /> {m.check}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setDialog({ edit: null })}>
              <Plus className="h-3.5 w-3.5" /> {m.add}
            </Button>
          </div>
        }
      >
        {m.title}
      </SectionTitle>
      <p className="mb-3 text-xs text-muted">{m.intro}</p>
      {list.isLoading && (
        <SkeletonRegion label={m.loading} className="divide-y divide-border rounded-lg border border-border">
          {[30, 45, 25].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
                <Skeleton className="h-2.5" style={{ width: `${w + 30}%` }} />
              </div>
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
            </div>
          ))}
        </SkeletonRegion>
      )}
      {list.isError && <ErrorBanner>{errorMessage(list.error)}</ErrorBanner>}
      {list.data?.length === 0 && <EmptyState icon={<Server className="h-8 w-8" />} title={m.empty} />}
      <div className={cn("divide-y divide-border rounded-lg border border-border", !list.data?.length && "hidden")}>
        {list.data?.map((s) => {
          const auth = authSummary(s);
          return (
            <div key={s.name} className="flex items-center gap-3 px-3 py-2 text-body" onContextMenu={contextItems(() => menu(s))}>
              <Server className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate">{shownName(s)}</span>
                  {s.origin && <Badge>{s.origin === "plugin" ? m.fromPlugin : m.fromClaudeAi}</Badge>}
                  {s.scope && <Badge>{mcpScopeLabel(s.scope)}</Badge>}
                  {auth && (
                    <Tooltip content={m.authSet(auth)}>
                      <KeyRound className="h-3.5 w-3.5 shrink-0 text-subtle" aria-label={m.authSet(auth)} />
                    </Tooltip>
                  )}
                </div>
                <div className="truncate font-mono text-caption text-subtle">{s.target}</div>
              </div>
              {canApprove(s) && (
                <Tooltip content={m.approveHint}>
                  <Button size="sm" variant="ghost" onClick={() => void approve(s)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> {m.approve}
                  </Button>
                </Tooltip>
              )}
              {s.status === "needs_auth" && <McpLoginButton name={s.name} projectId={projectId} />}
              <Badge tone={MCP_STATUS_TONE[s.status]}>
                <span title={mcpStatusText(s.statusText)}>{MCP_STATUS[s.status]}</span>
              </Badge>
              {!s.origin && (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={m.edit(s.name)}
                    title={s.scope ? m.edit(s.name) : m.readOnly}
                    disabled={!s.scope}
                    onClick={() => setDialog({ edit: s.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="danger-ghost" aria-label={m.remove(s.name)} onClick={() => askRemove(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <McpServerDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} projectId={projectId} editName={dialog?.edit ?? null} onSaved={refresh} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={m.removeTitle(removing?.name ?? "")}
        description={removing?.scope ? m.removeFrom(mcpScopeLabel(removing.scope)) : m.removeDescription}
        confirmLabel={m.removeConfirm}
        danger
        onConfirm={async () => {
          if (!removing) return;
          try {
            await call("mcp.remove", { projectId, name: removing.name, scope: removing.scope ?? scope });
            toast.success(m.removed, removing.name);
            refresh();
          } catch (e) {
            toast.error(m.notRemoved, errorMessage(e));
            throw e;
          }
        }}
      >
        {!removing?.scope && (
          <Field label={m.scope}>
            <Select value={scope} onChange={setScope} className="w-full" options={mcpScopeOptions(projectId)} />
          </Field>
        )}
      </ConfirmDialog>
    </section>
  );
}
