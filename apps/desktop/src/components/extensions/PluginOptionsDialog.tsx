import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarketplacePlugin, PluginOption } from "@forge/protocol";
import { call } from "@/lib/queries";
import { errorMessage } from "@/lib/rpc";
import { toast } from "@/stores/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge, ErrorBanner } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";

const m = t.extensions.marketplace.options;

/** Only what changed goes back; an empty secret keeps the stored one. */
export function changedValues(options: PluginOption[], values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of options) {
    const v = values[o.key];
    if (v === undefined || v === o.value) continue;
    if (o.sensitive && !v) continue;
    out[o.key] = v;
  }
  return out;
}

function OptionInput({ option, value, onChange }: { option: PluginOption; value: string; onChange: (v: string) => void }) {
  const isBool = option.choices.length === 2 && option.choices.includes("true") && option.choices.includes("false");
  if (isBool) return <Switch checked={value === "true"} onChange={(v) => onChange(String(v))} label={option.title} />;
  if (option.choices.length) return <Select value={value || undefined} onChange={onChange} className="w-full" options={option.choices.map((c) => ({ value: c, label: c }))} aria-label={option.title} />;
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={option.sensitive ? "password" : option.type === "number" ? "number" : "text"}
      placeholder={option.sensitive && option.isSet ? m.secretKept : undefined}
      autoComplete="off"
      aria-label={option.title}
    />
  );
}

/** The settings a plugin asks for, which otherwise only /plugin configure in the terminal offers. */
export function PluginOptionsDialog({ plugin, onClose }: { plugin: MarketplacePlugin | null; onClose: () => void }) {
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ["pluginOptions", plugin?.id], queryFn: () => call("plugins.options", { id: plugin!.id }), enabled: !!plugin, staleTime: 0, gcTime: 0 });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (options.data) setValues(Object.fromEntries(options.data.map((o) => [o.key, o.value])));
  }, [options.data]);
  const changed = changedValues(options.data ?? [], values);
  const save = async () => {
    if (!plugin) return;
    setSaving(true);
    try {
      qc.setQueryData(["pluginOptions", plugin.id], await call("plugins.configure", { id: plugin.id, values: changed }));
      toast.success(m.saved(plugin.name));
      onClose();
    } catch (e) {
      toast.error(m.notSaved(plugin.name), errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={!!plugin}
      onOpenChange={(o) => !o && onClose()}
      title={m.title(plugin?.name ?? "")}
      description={m.description}
      className="w-150"
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.ui.cancel}
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!Object.keys(changed).length}>
            {m.save}
          </Button>
        </>
      }
    >
      {options.isLoading && (
        <SkeletonRegion label={m.loading} className="flex flex-col gap-4">
          {[40, 55, 30].map((w) => (
            <div key={w} className="flex flex-col gap-1.5">
              <Skeleton className="h-3" style={{ width: `${w}%` }} />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </SkeletonRegion>
      )}
      {options.isError && <ErrorBanner>{errorMessage(options.error)}</ErrorBanner>}
      {options.data?.length === 0 && <p className="text-body text-muted">{m.none}</p>}
      {options.data?.map((o) => (
        <div key={o.key} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-body font-medium">
            {o.title}
            {o.required && !o.isSet && <Badge tone="warning">{m.required}</Badge>}
          </div>
          {o.description && <p className="text-xs text-muted">{o.description}</p>}
          <OptionInput option={o} value={values[o.key] ?? ""} onChange={(v) => setValues((cur) => ({ ...cur, [o.key]: v }))} />
        </div>
      ))}
    </Dialog>
  );
}
