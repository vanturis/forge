import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** Earlier messages found with Ctrl+R, in the place of the slash menu. */
export function ComposerHistoryMenu({ matches, index, onPick }: { matches: string[]; index: number; onPick: (entry: string) => void }) {
  const m = t.chat.composer.history;
  return (
    <div role="listbox" aria-label={m.label} className="absolute bottom-full left-6 right-6 z-20 mb-1 animate-rise-in overflow-hidden rounded-lg border border-border bg-surface-2 shadow-xl">
      {matches.map((entry, i) => (
        <button
          key={entry}
          type="button"
          role="option"
          aria-selected={i === index}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(entry);
          }}
          className={cn("flex w-full items-baseline gap-2 px-3 py-1.5 text-left", i === index ? "bg-surface-3" : "hover:bg-surface-3")}
        >
          <History className="h-3.5 w-3.5 shrink-0 self-center text-subtle" />
          <span className="min-w-0 truncate text-xs text-fg">{entry}</span>
        </button>
      ))}
      {!matches.length && <div className="px-3 py-1.5 text-xs text-muted">{m.none}</div>}
      <div className="border-t border-border px-3 py-1 text-caption text-subtle">{m.hint}</div>
    </div>
  );
}
