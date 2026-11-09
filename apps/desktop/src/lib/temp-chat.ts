import { focusComposer } from "@/components/workspace/chat-slot";
import { call, keys, queryClient } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { toast } from "@/stores/toast";
import { useUi } from "@/stores/ui";
import { t } from "@/i18n";

/** Opens a new temporary chat in the hidden project under `<folder for new projects>/tmp`, ready to type. */
export async function openTempChat() {
  try {
    const project = await call("projects.tmpChat", {});
    await queryClient.invalidateQueries({ queryKey: keys.projects });
    const ui = useUi.getState();
    ui.toggleGroup(project.id, false);
    ui.openProject(project.id, null);
    requestAnimationFrame(() => focusComposer({ pane: null }));
  } catch (e) {
    toast.error(t.layout.sidebar.tempChatFailed, errorMessage(e));
  }
}
