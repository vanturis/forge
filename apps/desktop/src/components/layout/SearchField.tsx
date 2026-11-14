import { Search } from "lucide-react";
import { useUi } from "@/stores/ui";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Looks like a search box, opens the command palette (Ctrl+K). Sits in the sidebar above the navigation,
 * `compact` in the middle of FORGE's own title bar.
 */
export function SearchField({ compact = false }: { compact?: boolean }) {
  return (
    <button
      onClick={() => useUi.getState().setPaletteOpen(true)}
      className={cn(
        "flex w-full items-center whitespace-nowrap rounded-full border border-border bg-surface-2 text-subtle shadow-xs transition-colors duration-120 hover:border-border-strong hover:text-muted",
        compact ? "h-7 gap-2 pl-3 pr-1.5" : "h-10 gap-2.5 pl-3.5 pr-2.5",
      )}
      aria-label={t.layout.searchField.label}
    >
      <Search className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span className={cn("flex-1 text-left", compact ? "text-small" : "text-body-lg")}>{t.layout.searchField.placeholder}</span>
      <Kbd>{t.layout.searchField.kbd}</Kbd>
    </button>
  );
}
