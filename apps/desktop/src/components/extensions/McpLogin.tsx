import { useState } from "react";
import { ExternalLink, LogIn, X } from "lucide-react";
import { call } from "@/lib/queries";
import { openExternal } from "@/lib/native";
import { errorMessage } from "@/lib/rpc";
import { useMcpLogin } from "@/stores/mcp-login";
import { toast } from "@/stores/toast";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/misc";
import { t } from "@/i18n";

const m = t.extensions.mcpTab.login;

export async function startMcpLogin(name: string, projectId: string | undefined) {
  try {
    await call("mcp.login", { name, projectId });
  } catch (e) {
    toast.error(m.failed(name), errorMessage(e));
  }
}

/** Sign-in at a server. The browser opens by itself; while it waits, the page can be opened again or the sign-in cancelled. */
export function McpLoginButton({ name, projectId }: { name: string; projectId?: string }) {
  const url = useMcpLogin((s) => s.waiting[name]);
  const [busy, setBusy] = useState(false);
  if (url)
    return (
      <div className="flex items-center gap-1">
        <span className="whitespace-nowrap text-caption text-muted">{m.waiting}</span>
        <Tooltip content={m.openAgain}>
          <Button size="icon-sm" variant="ghost" aria-label={m.openAgain} onClick={() => void openExternal(url)}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content={m.cancel}>
          <Button size="icon-sm" variant="ghost" aria-label={m.cancel} onClick={() => void call("mcp.loginCancel", { name })}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    );
  return (
    <Button
      size="sm"
      variant="primary"
      loading={busy}
      onClick={() => {
        setBusy(true);
        void startMcpLogin(name, projectId).finally(() => setBusy(false));
      }}
    >
      <LogIn className="h-3.5 w-3.5" /> {m.signIn}
    </Button>
  );
}
