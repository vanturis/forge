import { Blocks, PackageSearch, PenLine, Server, Webhook, type LucideIcon } from "lucide-react";
import { useProject } from "@/lib/queries";
import { useUi, type ExtensionsTab, type SkillsTab } from "@/stores/ui";
import { Page } from "@/components/layout/Page";
import { SettingsLayout, type SettingsSectionDef } from "@/components/settings/layout";
import { DocsTab } from "@/components/extensions/DocsTab";
import { HooksTab } from "@/components/extensions/HooksTab";
import { McpTab } from "@/components/extensions/McpTab";
import { SkillMarketplace } from "@/components/extensions/SkillMarketplace";
import { t } from "@/i18n";

/** Tabs of the view, shared with the command palette. */
export const EXTENSION_TAB_DEFS: ReadonlyArray<{ value: ExtensionsTab; label: string; Icon: LucideIcon }> = [
  { value: "mcp", label: t.views.extensions.tabMcp, Icon: Server },
  { value: "skills", label: t.views.extensions.tabSkills, Icon: Blocks },
  { value: "hooks", label: t.views.extensions.tabHooks, Icon: Webhook },
];

export const SKILLS_TAB_DEFS: ReadonlyArray<{ value: SkillsTab; label: string; Icon: LucideIcon }> = [
  { value: "marketplace", label: t.views.extensions.tabMarketplace, Icon: PackageSearch },
  { value: "own", label: t.views.extensions.tabOwnSkills, Icon: PenLine },
];

type Section = ExtensionsTab | SkillsTab;

/** The menu on the left, like the settings: the tabs, with the two kinds of skills as a branch under Skills. */
const SECTIONS: ReadonlyArray<SettingsSectionDef<Section>> = EXTENSION_TAB_DEFS.flatMap((def) => [
  { id: def.value, label: def.label, Icon: def.Icon },
  ...(def.value === "skills" ? SKILLS_TAB_DEFS.map((sub) => ({ id: sub.value, label: sub.label, Icon: sub.Icon, parent: "skills" as const })) : []),
]);

const isSkillsTab = (id: Section): id is SkillsTab => SKILLS_TAB_DEFS.some((d) => d.value === id);

/** Claude Code extensions: MCP servers, skills and hooks, for the user and the open project. */
export function ExtensionsView() {
  const tab = useUi((s) => s.extensionsTab);
  const skillsTab = useUi((s) => s.skillsTab);
  const openExtensions = useUi((s) => s.openExtensions);
  const projectId = useUi((s) => s.activeProjectId) ?? undefined;
  const project = useProject(projectId ?? null);
  // Under Skills one of its two branches is always the shown one.
  const current: Section = tab === "skills" ? skillsTab : tab;
  return (
    <Page
      title={t.views.extensions.title}
      subtitle={project.data ? t.views.extensions.subtitleProject(project.data.name) : t.views.extensions.subtitleGlobal}
    >
      <SettingsLayout sections={SECTIONS} current={current} onSelect={(id) => (isSkillsTab(id) ? openExtensions("skills", id) : openExtensions(id))} label={t.views.extensions.title} wide>
        {tab === "mcp" && <McpTab projectId={projectId} />}
        {tab === "skills" && (skillsTab === "marketplace" ? <SkillMarketplace /> : <DocsTab kind="skill" projectId={projectId} />)}
        {tab === "hooks" && <HooksTab projectId={projectId} />}
      </SettingsLayout>
    </Page>
  );
}
