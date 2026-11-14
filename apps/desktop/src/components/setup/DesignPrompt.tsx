import { useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@forge/protocol";
import { call, keys, useSettings } from "@/lib/queries";
import { useTransparencySupported } from "@/lib/design";
import { errorMessage } from "@/lib/rpc";
import { toast } from "@/stores/toast";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SectionTitle } from "@/components/ui/misc";
import { SchemePicker, TransparencyChoice } from "@/components/settings/SchemePicker";
import { t } from "@/i18n";

const tp = t.setup.designPrompt;

/**
 * Shows the design settings once to installations from before them: color scheme and transparency can be
 * chosen right here. New installations get the same choice as a step of the setup assistant, which
 * marks it as seen. Comes after the other one-time questions, so only one dialog is open at a time.
 */
export function DesignPrompt() {
  const s = useSettings().data;
  const wizard = useUi((u) => u.setupWizard);
  if (!s || !s.setupDone || !s.syncAsked || !s.usageStatsAsked || s.designAsked || wizard) return null;
  return <Prompt s={s} />;
}

function Prompt({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const openSettings = useUi((u) => u.openSettings);
  const transparent = useTransparencySupported();
  const save = async (patch: Partial<Settings>) => {
    try {
      qc.setQueryData(keys.settings, await call("settings.update", patch));
    } catch (e) {
      toast.error(tp.notSaved, errorMessage(e));
    }
  };
  // Seen is seen, however the dialog is closed: a notice about a new function does not come back.
  const close = () => void save({ designAsked: true });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={transparent ? tp.title : tp.titleSchemes}
      description={transparent ? tp.description : tp.descriptionSchemes}
      className="w-180"
      bodyClassName="flex flex-col gap-5 overflow-y-auto"
      // The window behind the dialog shows the chosen colors.
      overlayClassName="backdrop-blur-none"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              close();
              openSettings("design");
            }}
          >
            {tp.allSettings}
          </Button>
          <Button variant="primary" onClick={close}>
            {tp.done}
          </Button>
        </>
      }
    >
      <section>
        <SectionTitle>{tp.schemeTitle}</SectionTitle>
        <SchemePicker s={s} onPick={(id) => void save({ colorScheme: id })} />
      </section>
      {transparent && (
        <section>
          <SectionTitle>{tp.transparencyTitle}</SectionTitle>
          <TransparencyChoice value={s.transparency} onSave={(v) => void save({ transparency: v })} />
        </section>
      )}
      <p className="text-small text-subtle">{tp.hint}</p>
    </Dialog>
  );
}
