import { Search } from "lucide-react";
import { useUi } from "@/stores/ui";
import { Kbd } from "@/components/ui/misc";
import { t } from "@/i18n";

/** Looks like a search box, opens the command palette (Ctrl+K). Sits in the sidebar above the navigation. */
export function SearchField() {
  return (
    <button
      onClick={() => useUi.getState().setPaletteOpen(true)}
      className="flex h-10 w-full items-center gap-2.5 whitespace-nowrap rounded-full border border-border bg-surface-2 pl-3.5 pr-2.5 text-body-lg text-subtle shadow-xs transition-colors duration-120 hover:border-border-strong hover:text-muted"
      aria-label={t.layout.searchField.label}
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">{t.layout.searchField.placeholder}</span>
      <Kbd>{t.layout.searchField.kbd}</Kbd>
    </button>
  );
}
