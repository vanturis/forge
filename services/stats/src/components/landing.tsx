import { BarChart3, Bot, ChevronDown, Download, Folder, GitBranch, MessageCircle, Monitor, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import smithy960 from "@/assets/smithy-960.webp";
import smithy1536 from "@/assets/smithy-1536.webp";
import { DOWNLOAD_PAGE } from "@/lib/constants";
import { localePath, type Locale, type LocaleBase } from "@/lib/i18n";
import { i18n, type Messages } from "@/lib/messages";
import { Feature } from "./blocks";
import { Pixels, STEPS } from "./pixels";

/** The owner's pixel-art smithy (1536 x 1024) behind the right half of the hero, in two widths. */
const SMITHY = [smithy960, smithy1536] as const;

type FeatureKey = keyof Messages["landing"]["features"];

const FEATURES: { key: FeatureKey; icon: LucideIcon }[] = [
  { key: "projects", icon: Folder },
  { key: "ui", icon: MessageCircle },
  { key: "git", icon: GitBranch },
  { key: "workflow", icon: Settings },
];

/** Dots of the commit list and states of the agents in the two showcase graphics. */
const COMMIT_TONES = ["blue", "green", "accent"] as const;
const AGENT_BRANCHES = ["agent/testimonials", "agent/faq", "agent/trusted-by"] as const;
const AGENT_TONES = ["accent", "green", "muted"] as const;

/** The start page: title, lead and buttons in front of the smithy picture, four cards, the questions and the download once more. */
export function Landing({ locale, base }: { locale: Locale; base: LocaleBase }) {
  const { t } = i18n(locale);
  const l = t.landing;
  const stats = localePath("/stats", base);
  return (
    <main className="landing">
      <section className="hero">
        <div className="container">
          <div className="hero-text">
            <h1 className="hero-title">
              <span>{l.title}</span>
              <span className="hero-title-accent">{l.titleAccent}</span>
            </h1>
            <p className="hero-lead">{l.lead}</p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href={DOWNLOAD_PAGE}>
                <Download aria-hidden />
                {l.download}
              </a>
              <a className="btn btn-outline btn-lg" href={stats}>
                <BarChart3 aria-hidden />
                {l.liveStats}
              </a>
            </div>
            <ul className="hero-facts">
              <li>
                <Monitor aria-hidden />
                {l.facts.platforms}
              </li>
              <li>{l.facts.openSource}</li>
              <li>{l.facts.earlyAccess}</li>
            </ul>
          </div>
        </div>
        {/* Decoration: fades into the page toward the text and the bottom (pages.css). */}
        <div className="hero-art" aria-hidden>
          <img
            src={smithy1536.src}
            srcSet={SMITHY.map((s) => `${s.src} ${s.width}w`).join(", ")}
            sizes="(max-width: 1080px) 100vw, 62vw"
            width={smithy1536.width}
            height={smithy1536.height}
            alt=""
            fetchPriority="high"
          />
        </div>
        <Pixels rows={STEPS} size={14} flip className="hero-pixels hero-pixels-left" />
        <Pixels rows={STEPS} size={14} className="hero-pixels hero-pixels-right" />
      </section>

      <section className="container landing-features" aria-labelledby="features-title">
        <h2 id="features-title" className="landing-h2">
          {l.featuresTitle}
        </h2>
        <div className="features features-plain">
          {FEATURES.map(({ key, icon }, i) => (
            <Feature key={key} icon={icon} title={l.features[key].title} text={l.features[key].text} index={i} />
          ))}
        </div>
      </section>

      <section className="container landing-showcases">
        <article className="showcase" aria-labelledby="showcase-git">
          <div className="mock" aria-hidden>
            <div className="mock-head">
              <span className="mock-title">Git</span>
              <span className="mock-count">22</span>
            </div>
            <ul className="mock-commits">
              {l.showcase.git.commits.map((commit, i) => (
                <li key={commit} data-tone={COMMIT_TONES[i % COMMIT_TONES.length]}>
                  {commit}
                </li>
              ))}
            </ul>
          </div>
          <div className="showcase-text">
            <h2 id="showcase-git" className="landing-h2">
              {l.showcase.git.title}
            </h2>
            <p>{l.showcase.git.text}</p>
          </div>
          <Pixels rows={STEPS} className="showcase-pixels" />
        </article>

        <article className="showcase showcase-flip" aria-labelledby="showcase-agents">
          <div className="mock" aria-hidden>
            <div className="mock-head">
              <span className="mock-title">{l.showcase.agents.panel}</span>
              <span className="mock-count">{AGENT_BRANCHES.length}</span>
            </div>
            <ul className="mock-agents">
              {AGENT_BRANCHES.map((branch, i) => (
                <li key={branch}>
                  <Bot />
                  <span className="mock-branch">{branch}</span>
                  <span className="mock-state" data-tone={AGENT_TONES[i]}>
                    {l.showcase.agents.states[i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="showcase-text">
            <h2 id="showcase-agents" className="landing-h2">
              {l.showcase.agents.title}
            </h2>
            <p>{l.showcase.agents.text}</p>
          </div>
          <Pixels rows={STEPS} flip className="showcase-pixels" />
        </article>
      </section>

      <section className="container landing-faq" id="faq" aria-labelledby="faq-title">
        <header className="section-head">
          <h2 id="faq-title">{l.faq.title}</h2>
          <p>{l.faq.lead}</p>
        </header>
        <div className="faq">
          {l.faq.items.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>
                <h3>{item.q}</h3>
                <span className="faq-toggle" aria-hidden>
                  <ChevronDown />
                </span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container landing-closing" aria-labelledby="closing-title">
        <div className="closing">
          <h2 id="closing-title">{t.download.title}</h2>
          <p>{t.download.lead}</p>
          <div className="closing-actions">
            <a className="btn btn-primary btn-lg" href={DOWNLOAD_PAGE}>
              <Download aria-hidden />
              {l.download}
            </a>
            <a className="btn btn-outline btn-lg" href={stats}>
              <BarChart3 aria-hidden />
              {l.liveStats}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
