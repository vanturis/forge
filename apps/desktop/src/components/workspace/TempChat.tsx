import { MessageSquareDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Tooltip } from "@/components/ui/misc";
import { t } from "@/i18n";

/** Stands in for the project icon of the project behind the temporary chats. */
export function TempChatIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent", className)} style={{ width: size, height: size }}>
      <MessageSquareDashed style={{ width: size * 0.62, height: size * 0.62 }} />
    </span>
  );
}

/** Marks a chat as temporary, with the hint that it goes away after 30 days. */
export function TempChatBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Tooltip content={t.workspace.tempChat.hint}>
      <span className="shrink-0" aria-label={`${t.workspace.tempChat.badge}. ${t.workspace.tempChat.hint}`}>
        <Badge tone="accent">
          <MessageSquareDashed className="h-3 w-3" />
          {!compact && t.workspace.tempChat.badge}
        </Badge>
      </span>
    </Tooltip>
  );
}
