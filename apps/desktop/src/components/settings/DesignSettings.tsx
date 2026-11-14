import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { activeColorScheme, colorSchemes, CUSTOM_SCHEME_PREFIX, DEFAULT_SCHEME_ID, MAX_CUSTOM_SCHEMES, type ColorScheme, type CustomScheme, type SchemeColors, type Settings } from "@forge/protocol";
import { previewScheme, supportsWindowOpacity } from "@/lib/design";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Group, Row } from "@/components/settings/layout";
import { OpacitySlider, SchemePicker, SchemePreview } from "./SchemePicker";
import { t } from "@/i18n";

const td = t.settings.design;

type Save = (patch: Partial<Settings>) => Promise<void>;

/** What the editor works on: a new scheme (from a template) or one of the user's own. */
interface Draft {
  /** null: not saved yet */
  id: string | null;
  name: string;
  colors: SchemeColors;
}

function newId(): string {
  return `${CUSTOM_SCHEME_PREFIX}${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
}

/** Settings, Design: the color scheme (presets and the user's own) and the opacity of the windows. */
export function DesignSettings({ s, save }: { s: Settings; save: Save }) {
  const openSettings = useUi((u) => u.openSettings);
  const request = useUi((u) => u.designRequest);
  const setRequest = useUi((u) => u.setDesignRequest);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<ColorScheme | null>(null);
  const full = s.customSchemes.length >= MAX_CUSTOM_SCHEMES;

  const copyOf = (scheme: ColorScheme): Draft => ({ id: null, name: scheme.custom || scheme.id !== DEFAULT_SCHEME_ID ? td.editor.copyName(scheme.name) : "", colors: { ...scheme.colors } });

  // The palette asks for the editor ("Eigenes Farbschema anlegen").
  useEffect(() => {
    if (request !== "new") return;
    setRequest(null);
    if (!full) setDraft(copyOf(activeColorScheme(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the request opens the editor
  }, [request]);

  const saveDraft = async (d: Draft) => {
    const id = d.id ?? newId();
    const scheme: CustomScheme = { id, name: d.name.trim(), colors: d.colors };
    const customSchemes = d.id ? s.customSchemes.map((x) => (x.id === d.id ? scheme : x)) : [...s.customSchemes, scheme];
    await save({ customSchemes, colorScheme: id });
    setDraft(null);
  };

  return (
    <>
      <Group
        title={td.schemeTitle}
        description={td.schemeDescription}
        action={
          <Button size="sm" onClick={() => setDraft(copyOf(activeColorScheme(s)))} disabled={full} title={full ? td.tooMany(MAX_CUSTOM_SCHEMES) : undefined}>
            <Plus className="h-3.5 w-3.5" /> {td.newScheme}
          </Button>
        }
      >
        <div className="p-4">
          <SchemePicker
            s={s}
            onPick={(id) => void save({ colorScheme: id })}
            actions={{
              onEdit: (scheme) => setDraft({ id: scheme.id, name: scheme.name, colors: { ...scheme.colors } }),
              onDuplicate: (scheme) => !full && setDraft(copyOf(scheme)),
              onDelete: setDeleting,
            }}
          />
        </div>
      </Group>

      {supportsWindowOpacity && (
        <Group title={td.windowTitle}>
          <Row label={td.opacityLabel} description={td.opacityDescription}>
            <OpacitySlider value={s.windowOpacity} onSave={(v) => void save({ windowOpacity: v })} className="w-72" />
          </Row>
        </Group>
      )}

      <p className="px-1 text-small text-subtle">
        {s.syncEnabled ? td.syncOn : td.syncOff}{" "}
        {!s.syncEnabled && (
          <button type="button" className="underline hover:text-fg" onClick={() => openSettings("github")}>
            {td.syncOpen}
          </button>
        )}
      </p>

      {draft && <SchemeEditor draft={draft} schemes={colorSchemes(s.customSchemes)} onClose={() => setDraft(null)} onSave={saveDraft} />}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? td.deleteTitle(deleting.name) : ""}
        description={td.deleteText}
        confirmLabel={td.delete}
        danger
        onConfirm={async () => {
          if (!deleting) return;
          const customSchemes = s.customSchemes.filter((x) => x.id !== deleting.id);
          await save(s.colorScheme === deleting.id ? { customSchemes, colorScheme: DEFAULT_SCHEME_ID } : { customSchemes });
          setDeleting(null);
        }}
      />
    </>
  );
}

const COLOR_KEYS = ["bg", "surface", "fg", "accent", "success", "warning", "danger"] as const satisfies ReadonlyArray<keyof SchemeColors>;

/**
 * Editor of one of the user's schemes. The whole window shows the colors while it is open
 * (previewScheme); only "Speichern" keeps them, closing goes back to the saved scheme.
 */
function SchemeEditor({ draft, schemes, onClose, onSave }: { draft: Draft; schemes: ColorScheme[]; onClose: () => void; onSave: (d: Draft) => Promise<void> }) {
  const [name, setName] = useState(draft.name);
  const [colors, setColors] = useState(draft.colors);
  const [busy, setBusy] = useState(false);
  const scheme: ColorScheme = { id: draft.id ?? `${CUSTOM_SCHEME_PREFIX}draft`, name, colors, custom: true };

  useEffect(() => {
    previewScheme({ id: draft.id ?? `${CUSTOM_SCHEME_PREFIX}draft`, name: "", colors, custom: true });
  }, [colors, draft.id]);
  useEffect(() => () => previewScheme(null), []);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({ id: draft.id, name, colors });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={draft.id ? td.editor.editTitle : td.editor.newTitle}
      description={td.editor.description}
      className="w-150"
      bodyClassName="flex flex-col gap-4"
      // The dialog shall not hide what the colors do to the app behind it.
      overlayClassName="bg-transparent backdrop-blur-none"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.ui.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={busy} disabled={!name.trim()}>
            {td.editor.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label={td.editor.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={td.editor.namePlaceholder} maxLength={40} autoFocus />
        </Field>
        <Field label={td.editor.basedOn}>
          <Select
            value={undefined}
            placeholder={td.editor.basedOnPlaceholder}
            onChange={(id) => {
              const from = schemes.find((x) => x.id === id);
              if (from) setColors({ ...from.colors });
            }}
            options={schemes.filter((x) => x.id !== draft.id).map((x) => ({ value: x.id, label: x.name }))}
            className="w-full"
            aria-label={td.editor.basedOn}
          />
        </Field>
      </div>
      <SchemePreview scheme={scheme} className="h-24" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {COLOR_KEYS.map((k) => (
          <ColorField key={k} label={td.editor.colors[k]} value={colors[k]} onChange={(v) => setColors((c) => ({ ...c, [k]: v }))} />
        ))}
      </div>
    </Dialog>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A color as swatch (opens the system's color picker) and as hex value to type or paste. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const take = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const full = v.startsWith("#") ? v : `#${v}`;
    if (HEX.test(full)) onChange(full);
    else setText(value);
  };
  return (
    // No <label> around it: there are two controls for the one color.
    <div>
      <span className="mb-1.5 flex h-4 text-xs font-medium text-muted">{label}</span>
      <div className="flex gap-2">
        <span className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-border-strong shadow-xs" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} aria-label={td.editor.pick(label)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </span>
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim().toLowerCase();
            if (HEX.test(v)) onChange(v);
          }}
          onBlur={(e) => take(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && take(e.currentTarget.value)}
          maxLength={7}
          spellCheck={false}
          aria-label={label}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
