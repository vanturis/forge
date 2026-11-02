import { CircleAlert, Copy } from "lucide-react";
import { contextItems, copyText } from "@/lib/context-menu";
import { Badge } from "@/components/ui/misc";
import { LinkedText } from "./file-links";
import { t } from "@/i18n";

interface Finding {
  file: string;
  line: number | null;
  summary: string;
  scenario: string;
  category: string | null;
  verdict: string | null;
  outcome: string | null;
}

/** The findings of a /code-review as the CLI reports them (tool ReportFindings). Tolerates missing fields. */
export function parseFindings(input: Record<string, unknown>): Finding[] {
  const list = Array.isArray(input.findings) ? (input.findings as Array<Record<string, unknown>>) : [];
  return list.flatMap((f) =>
    f && typeof f.file === "string" && typeof f.summary === "string"
      ? [
          {
            file: f.file,
            line: typeof f.line === "number" ? f.line : null,
            summary: f.summary,
            scenario: typeof f.failure_scenario === "string" ? f.failure_scenario : "",
            category: typeof f.category === "string" ? f.category : null,
            verdict: typeof f.verdict === "string" ? f.verdict : null,
            outcome: typeof f.outcome === "string" ? f.outcome : null,
          },
        ]
      : [],
  );
}

const asText = (f: Finding) => `${f.file}${f.line ? `:${f.line}` : ""}: ${f.summary}${f.scenario ? `\n${f.scenario}` : ""}`;

export function FindingsCard({ input }: { input: Record<string, unknown> }) {
  const m = t.chat.cards.findings;
  const findings = parseFindings(input);
  const verdict: Record<string, string> = { CONFIRMED: m.confirmed, PLAUSIBLE: m.plausible };
  const outcome: Record<string, string> = { fixed: m.fixed, skipped: m.skipped, no_change_needed: m.noChange };
  return (
    <div className="rounded-md border border-border bg-surface" role="group" aria-label={m.title(findings.length)}>
      <div className="flex items-center gap-2 px-3 py-2 text-body">
        <CircleAlert className={findings.length ? "h-4 w-4 text-warning" : "h-4 w-4 text-success"} />
        <span className="font-medium">{m.title(findings.length)}</span>
      </div>
      <div className="divide-y divide-border border-t border-border">
        {!findings.length && <div className="px-3 py-2 text-xs text-muted">{m.none}</div>}
        {findings.map((f, i) => (
          <div key={i} className="space-y-1 px-3 py-2.5" onContextMenu={contextItems(() => [{ label: m.copy, icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void copyText(asText(f)) }])}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all font-mono text-small">
                <LinkedText text={`${f.file}${f.line ? `:${f.line}` : ""}`} />
              </span>
              {f.category && <Badge>{f.category}</Badge>}
              {f.verdict && verdict[f.verdict] && <Badge tone={f.verdict === "CONFIRMED" ? "danger" : "warning"}>{verdict[f.verdict]}</Badge>}
              {f.outcome && outcome[f.outcome] && <Badge tone={f.outcome === "fixed" ? "success" : "neutral"}>{outcome[f.outcome]}</Badge>}
            </div>
            <div className="text-body">{f.summary}</div>
            {f.scenario && (
              <div className="text-xs text-muted">
                {m.scenario}: {f.scenario}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
