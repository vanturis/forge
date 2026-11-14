import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelWithDescription } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";

export interface SettingsSectionDef<Id extends string> {
  id: Id;
  label: string;
  /** what the section holds, shown as tooltip */
  hint?: string;
  Icon: LucideIcon;
  /** shown as a branch under this section, like in a file tree */
  parent?: Id;
}

/** Settings page frame: section menu on the left, the chosen section on the right. Shared by the app and the project settings. */
export function SettingsLayout<Id extends string>({
  sections,
  current,
  onSelect,
  label,
  wide,
  children,
}: {
  sections: ReadonlyArray<SettingsSectionDef<Id>>;
  current: Id;
  onSelect: (id: Id) => void;
  label: string;
  /** lists and tables instead of form rows: the content takes the width that is left */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-6xl gap-8">
      <nav className="sticky top-0 flex w-52 shrink-0 flex-col gap-0.5 self-start" aria-label={label}>
        {sections
          .filter((x) => !x.parent)
          .map((x) => {
            const children = sections.filter((c) => c.parent === x.id);
            return (
              <div key={x.id} className="flex flex-col gap-0.5">
                <SectionButton section={x} active={x.id === current} onSelect={onSelect} />
                {children.length > 0 && (
                  // Tree lines from the parent's icon (20px in): a bend to each child, the trunk runs on to the next one.
                  <div className="ml-5 flex flex-col gap-0.5">
                    {children.map((c, i) => (
                      <div
                        key={c.id}
                        className={cn(
                          "relative pl-4 before:absolute before:left-0 before:-top-0.5 before:h-[calc(50%+0.125rem)] before:w-3 before:rounded-bl-md before:border-b before:border-l before:border-border-strong",
                          i < children.length - 1 && "after:absolute after:-bottom-0.5 after:left-0 after:top-1/2 after:border-l after:border-border-strong",
                        )}
                      >
                        <SectionButton section={c} active={c.id === current} onSelect={onSelect} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Keyed per section: each switch fades the new section in. */}
      <div key={current} className={cn("flex min-w-0 flex-1 animate-view-in flex-col gap-6 pb-10", !wide && "max-w-3xl")}>
        {children}
      </div>
    </div>
  );
}

function SectionButton<Id extends string>({ section: x, active, onSelect }: { section: SettingsSectionDef<Id>; active: boolean; onSelect: (id: Id) => void }) {
  return (
    // Second level of navigation: the same pill as the main navigation, neutral instead of orange (like the active tab).
    <button
      onClick={() => onSelect(x.id)}
      aria-current={active ? "page" : undefined}
      title={x.hint}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-full px-3.5 text-left text-body-lg font-medium transition-[color,background-color,box-shadow,transform] duration-120 active:scale-[0.98]",
        active ? "bg-surface-3 text-fg shadow-xs" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <x.Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} />
      <span className="min-w-0 truncate">{x.label}</span>
    </button>
  );
}

/** A titled card of settings rows. */
export function Group({ title, description, action, danger, children }: { title: ReactNode; description?: ReactNode; action?: ReactNode; danger?: boolean; children: ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-surface shadow-sm", danger ? "border-danger/30" : "border-border")}>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5">
        <LabelWithDescription description={description}>
          <h2 className="text-ui font-semibold">{title}</h2>
        </LabelWithDescription>
        {action}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** One setting: what it is and what it does on the left, the control on the right (or below with `stacked`). */
export function Row({ label, description, children, stacked }: { label: ReactNode; description?: ReactNode; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cn("px-4 py-3.5", stacked ? "flex flex-col gap-2.5" : "flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5")}>
      {/* A wide control moves below the label instead of squeezing the description into a narrow column.
          Stacked, the basis would be a height of 14rem: empty space above the control. */}
      <LabelWithDescription description={description} className={stacked ? undefined : "flex-[1_1_14rem]"}>
        <span className="text-body font-medium">{label}</span>
      </LabelWithDescription>
      {children}
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row label={label} description={description}>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </Row>
  );
}
