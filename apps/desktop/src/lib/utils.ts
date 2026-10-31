import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { planName } from "@forge/protocol";
import { language, locale, t } from "@/i18n";

export function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** "Ultra Abo", "Max Abo", "Pro Abo"; null without a plan. */
export function planLabel(auth: { subscriptionType: string | null; rateLimitTier: string | null }): string | null {
  if (!auth.subscriptionType) return null;
  return t.lib.plan(planName(auth.subscriptionType, auth.rateLimitTier));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return t.lib.time.never;
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return t.lib.time.justNow;
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString(locale);
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

export function formatTokens(n: number | null): string {
  if (n === null) return t.lib.tokensUnknown;
  if (n < 1000) return String(n);
  const k = (n / 1000).toFixed(1);
  return `${language === "de" ? k.replace(".", ",") : k}k`;
}

/** Shortens a path for display: keeps the last segments, replaces the home dir with ~. */
export function shortPath(p: string, keep = 3): string {
  const norm = p.replace(/\\/g, "/");
  const home = norm.match(/^([A-Za-z]:\/Users\/[^/]+|\/home\/[^/]+|\/Users\/[^/]+)/)?.[0];
  const withHome = home ? "~" + norm.slice(home.length) : norm;
  const parts = withHome.split("/");
  return parts.length > keep + 1 ? "…/" + parts.slice(-keep).join("/") : withHome;
}
