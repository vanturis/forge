import type { Metadata } from "next";
import { ChangelogPage, type ChangelogState } from "@/components/changelog";
import { getRoute } from "@/lib/locale-server";
import { getReleases, toChangelog } from "@/lib/releases";
import { changelogJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

// Rendered per request; getReleases() keeps the list from GitHub for 15 minutes.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, base } = await getRoute();
  return pageMetadata("/changelog", locale, base);
}

export default async function Changelog() {
  let state: ChangelogState;
  try {
    state = { kind: "ok", entries: toChangelog(await getReleases()) };
  } catch (err) {
    console.error("changelog failed:", err instanceof Error ? err.message : err);
    state = { kind: "error" };
  }
  const { locale, base } = await getRoute();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(changelogJsonLd(locale, base)) }} />
      <ChangelogPage state={state} locale={locale} />
    </>
  );
}
