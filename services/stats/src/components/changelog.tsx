import { ExternalLink, TriangleAlert } from "lucide-react";
import { REPO_URL } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";
import { i18n } from "@/lib/messages";
import type { ChangelogEntry } from "@/lib/releases";
import { Skeleton } from "./blocks";

export type ChangelogState = { kind: "loading" } | { kind: "error" } | { kind: "ok"; entries: ChangelogEntry[] };

/** Lines per placeholder card, so the loading page has the rhythm of real releases. */
const SKELETON_ROWS = [6, 3, 4];

/** "What's new": every published version as a card with its changes, newest first. */
export function ChangelogPage({ state, locale }: { state: ChangelogState; locale: Locale }) {
  const { t, f } = i18n(locale);
  const c = t.changelog;
  return (
    <main className="container changelog" aria-busy={state.kind === "loading" || undefined}>
      <header className="stats-head">
        <h1>
          {c.title} <span className="stats-title-accent">{c.titleAccent}</span>
        </h1>
        <p>{c.lead}</p>
      </header>
      {c.notesLanguage && <p className="changelog-note">{c.notesLanguage}</p>}

      {state.kind === "error" ? (
        <div className="error-banner" role="alert">
          <TriangleAlert aria-hidden />
          <div>
            <div className="error-title">{c.unavailableTitle}</div>
            <div>{c.unavailableText}</div>
          </div>
        </div>
      ) : state.kind === "loading" ? (
        <ol className="releases">
          {SKELETON_ROWS.map((rows, i) => (
            <li key={i} className="release">
              <div className="release-head">
                <h2>
                  <Skeleton width="5.5rem" />
                </h2>
                <span className="release-date">
                  <Skeleton width="9rem" />
                </span>
              </div>
              <ul className="release-items">
                {Array.from({ length: rows }, (_, r) => (
                  <li key={r}>
                    <span className="release-area">
                      <Skeleton width={`${45 + ((r * 19) % 40)}%`} />
                    </span>
                    <span>
                      <Skeleton width={`${50 + ((r * 23 + i * 11) % 45)}%`} />
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : state.entries.length === 0 ? (
        <p className="chart-empty changelog-empty">{c.empty}</p>
      ) : (
        <ol className="releases">
          {state.entries.map((e, i) => (
            <li key={e.version} className="release" id={`v${e.version}`}>
              <div className="release-head">
                <h2>v{e.version}</h2>
                {i === 0 && <span className="share-badge release-badge">{c.latest}</span>}
                <span className="release-date">
                  {e.publishedAt && <time dateTime={e.publishedAt}>{f.date(e.publishedAt)}</time>}
                  {e.publishedAt && " · "}
                  {c.changes(e.items.length)}
                </span>
                {e.url && (
                  <a className="release-link" href={e.url} aria-label={`${c.onGithub}: v${e.version}`} title={c.onGithub}>
                    <ExternalLink aria-hidden />
                  </a>
                )}
              </div>
              <ul className="release-items">
                {e.items.map((item, n) => (
                  <li key={n}>
                    <span className="release-area">{item.area}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <p className="changelog-more">
        <a className="btn btn-outline" href={`${REPO_URL}/releases`}>
          <ExternalLink aria-hidden />
          {c.allReleases}
        </a>
      </p>
    </main>
  );
}
