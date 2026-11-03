import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectWithStatus, PromptTemplate } from "@forge/protocol";
import { call, keys, useCrew, useDevChannel, useGitHubAccount, usePhoneState, useProjects, useRuntimeInfo, useSession, useSettings, useTemplates } from "@/lib/queries";
import { useChatWindows } from "@/lib/chat-windows";
import { splitActive, useUi } from "@/stores/ui";
import type { ActionContext, PaletteDialog } from "./palette-actions";

const NO_TEMPLATES: PromptTemplate[] = [];
const NO_AGENTS: ProjectWithStatus[] = [];

/** Everything buildActions needs, for the command palette and the macOS menu bar alike. */
export function useActionContext(openDialog: (d: PaletteDialog) => void): ActionContext & { projectId: string | null } {
  const qc = useQueryClient();
  const view = useUi((s) => s.view);
  const activeProjectId = useUi((s) => s.activeProjectId);
  const activeSessions = useUi((s) => s.activeSession);
  const projects = useProjects();
  const settings = useSettings().data;
  const models = useRuntimeInfo().data?.models;
  const phone = usePhoneState().data;
  const githubConnected = !!useGitHubAccount().data;
  const devChannel = useDevChannel(githubConnected).data;
  const remote = useQuery({ queryKey: keys.remote, queryFn: () => call("remote.state", {}) }).data;
  const projectId = view === "workspace" ? activeProjectId : null;
  const project = projects.data?.find((p) => p.id === projectId) ?? null;
  const root = project?.parentId ? (projects.data?.find((p) => p.id === project.parentId) ?? null) : project;
  const allProjects = projects.data;
  const agents = useMemo(() => (root ? (allProjects ?? []).filter((p) => p.parentId === root.id && p.exists) : NO_AGENTS), [allProjects, root]);
  const devServer = useQuery({ queryKey: keys.devServer(projectId ?? ""), queryFn: () => call("devserver.state", { projectId: projectId! }), enabled: !!projectId }).data;
  const testDb = useQuery({ queryKey: keys.testDb(projectId ?? ""), queryFn: () => call("testdb.state", { projectId: projectId! }), enabled: !!projectId, staleTime: Infinity }).data;
  const session = useSession(projectId ? splitActive(activeSessions[projectId]).sessionId : null).data ?? null;
  const templates = useTemplates(projectId).data ?? NO_TEMPLATES;
  const crew = useCrew(root?.gitEnabled ? root.id : null).crew;
  const chatSessions = useChatWindows((s) => s.sessions);
  const chatPinned = useChatWindows((s) => s.pinned);
  const chatWindows = useMemo(() => ({ sessions: chatSessions, pinned: chatPinned }), [chatSessions, chatPinned]);

  return useMemo(
    () => ({ projectId, qc, project, root, agents, session, settings, models: models ?? [], devServer, testDb, phone, remote, githubConnected, devChannel, templates, chatWindows, crew, openDialog }),
    [projectId, qc, project, root, agents, session, settings, models, devServer, testDb, phone, remote, githubConnected, devChannel, templates, chatWindows, crew, openDialog],
  );
}
