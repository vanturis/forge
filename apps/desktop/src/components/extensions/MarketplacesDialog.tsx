import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Store, Trash2 } from "lucide-react";
import type { PluginMarketplaceSource } from "@forge/protocol";
import { call } from "@/lib/queries";
import { contextItems, copyText } from "@/lib/context-menu";
import { errorMessage } from "@/lib/rpc";
import { toast } from "@/stores/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/misc";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { t } from "@/i18n";

const m = t.extensions.marketplace.sources;
const KEY = ["pluginMarketplaces"] as const;

/** Which marketplaces plugins come from; otherwise only `claude plugin marketplace` in the terminal. */
export function MarketplacesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => call("plugins.marketplaces", {}), enabled: open, staleTime: 0 });
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PluginMarketplaceSource | null>(null);
  const add = async () => {
    const s = source.trim();
    if (!s) return;
    setAdding(true);
    try {
      qc.setQueryData(KEY, await call("plugins.addMarketplace", { source: s }));
      setSource("");
      toast.success(m.added(s));
    } catch (e) {
      toast.error(m.notAdded(s), errorMessage(e));
    } finally {
      setAdding(false);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={m.title} description={m.description} className="w-150" bodyClassName="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder={m.placeholder} aria-label={m.placeholder} />
          <Button type="submit" variant="primary" loading={adding} disabled={!source.trim()}>
            <Plus className="h-3.5 w-3.5" /> {m.add}
          </Button>
        </form>
        <p className="text-xs text-subtle">{m.trust}</p>
        {list.isLoading && (
          <SkeletonRegion label={m.loading} className="divide-y divide-border rounded-lg border border-border">
            {[30, 45].map((w) => (
              <div key={w} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-4 w-4" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3" style={{ width: `${w}%` }} />
                  <Skeleton className="h-2.5" style={{ width: `${w + 25}%` }} />
                </div>
              </div>
            ))}
          </SkeletonRegion>
        )}
        {list.isError && <ErrorBanner>{errorMessage(list.error)}</ErrorBanner>}
        {!!list.data?.length && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.data.map((s) => (
              <li key={s.name} className="flex items-center gap-3 px-3 py-2 text-body" onContextMenu={contextItems(() => [{ label: m.copy, onSelect: () => void copyText(s.location || s.name) }, { label: m.remove(s.name), danger: true, onSelect: () => setRemoving(s) }])}>
                <Store className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.name}</div>
                  <div className="truncate font-mono text-caption text-subtle">{s.location}</div>
                </div>
                <Button size="icon-sm" variant="danger-ghost" aria-label={m.remove(s.name)} onClick={() => setRemoving(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={m.remove(removing?.name ?? "")}
        description={m.removeDescription}
        confirmLabel={m.removeConfirm}
        danger
        onConfirm={async () => {
          if (!removing) return;
          try {
            qc.setQueryData(KEY, await call("plugins.removeMarketplace", { name: removing.name }));
          } catch (e) {
            toast.error(m.notRemoved(removing.name), errorMessage(e));
            throw e;
          }
        }}
      />
    </>
  );
}
