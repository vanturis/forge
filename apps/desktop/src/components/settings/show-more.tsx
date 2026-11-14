import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/** Long lists in the settings show their first entries; the rest comes in steps with a button below. */
const FIRST_SHOWN = 3;
const MORE_STEP = 10;

/**
 * How many rows of a list are shown, and the button below it that shows more or folds them away again
 * (null while everything fits). `moreLabel` names the rest, e.g. "Ältere anzeigen (4)".
 */
export function useShown(total: number, moreLabel: (rest: number) => string = t.ui.showMore) {
  const [wanted, setWanted] = useState(FIRST_SHOWN);
  const shown = Math.min(wanted, total);
  const button =
    total <= FIRST_SHOWN ? null : (
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setWanted(shown < total ? shown + MORE_STEP : FIRST_SHOWN)}>
        {shown < total ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        {shown < total ? moreLabel(total - shown) : t.ui.showFewer}
      </Button>
    );
  return { shown, button };
}
