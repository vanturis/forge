import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import type { ClaudeStartUpdate } from "@forge/protocol";
import { call, keys, useClaudeSetup, useClaudeStartUpdate } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { t } from "@/i18n";

const tu = t.app.claudeStartUpdate;

/**
 * Keeps the app closed while FORGE installs a Claude Code update at its start. The app is not mounted
 * below a cover but left out: shortcuts, dialogs and the queries of the views would reach past a cover.
 * The sidecar holds session starts back on its own; this only shows it.
 */
export function ClaudeStartUpdateGate({ starting, children }: { starting: ReactNode; children: ReactNode }) {
  const query = useClaudeStartUpdate();
  // "Go on without the update" must open the app even when the sidecar does not answer.
  const [released, setReleased] = useState(false);
  const s = query.data;
  if (released || query.isError) return children;
  // The check takes a moment at most: it reads as part of the start, not as a screen of its own.
  if (!s || s.phase === "checking") return starting;
  if (s.phase === "updating" || s.phase === "failed") return <StartUpdateLock state={s} onRelease={() => setReleased(true)} />;
  return children;
}

function StartUpdateLock({ state, onRelease }: { state: ClaudeStartUpdate; onRelease: () => void }) {
  const qc = useQueryClient();
  const setup = useClaudeSetup().data;
  const [busy, setBusy] = useState<"retry" | "skip" | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const failed = state.phase === "failed";
  const lastLine = setup && (setup.task === "update" || setup.task === "install") ? setup.log.at(-1) : undefined;

  const resolve = async (action: "retry" | "skip") => {
    setBusy(action);
    setRetryError(null);
    try {
      qc.setQueryData(keys.claudeStartUpdate, await call("claude.resolveStartUpdate", { action }));
    } catch (e) {
      if (action === "skip") onRelease();
      else setRetryError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const skip = (
    <Button variant="outline" loading={busy === "skip"} disabled={busy !== null} onClick={() => void resolve("skip")}>
      {tu.skip}
    </Button>
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6">
      <Logo height={53} />
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm" role={failed ? "alert" : "status"}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {failed ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <Spinner className="shrink-0 text-accent" />}
          {failed ? tu.failed : tu.updating}
        </div>
        {state.installed && state.latest && (
          <div className="flex items-center gap-2 text-body text-muted" aria-label={tu.versions(state.installed, state.latest)}>
            <span className="font-mono">{state.installed}</span>
            <ArrowRight className="h-3.5 w-3.5 text-subtle" aria-hidden />
            <span className="font-mono text-fg">{state.latest}</span>
          </div>
        )}
        {failed ? (
          <>
            <p className="max-h-32 w-full overflow-auto break-words text-body text-muted">{retryError ?? state.message ?? tu.unknownReason}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button variant="primary" loading={busy === "retry"} disabled={busy !== null} onClick={() => void resolve("retry")}>
                <RotateCw className="h-3.5 w-3.5" /> {tu.retry}
              </Button>
              {skip}
            </div>
            <p className="text-xs text-subtle">{tu.settingHint}</p>
          </>
        ) : (
          <>
            {/* One line of fixed height: the card must not jump with every line the updater prints. */}
            <div className="h-4 w-full truncate font-mono text-caption text-muted" aria-live="polite">
              {lastLine ?? tu.preparing}
            </div>
            <p className="text-xs text-subtle">{state.skippable ? tu.slow : tu.hint}</p>
            {state.skippable && <div className="pt-1">{skip}</div>}
          </>
        )}
      </div>
    </div>
  );
}
