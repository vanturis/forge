import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Small building blocks shared by the start page and the statistics.

/** A round card with an icon tile, a title and a few words: the four cards of the start page and the privacy notes. */
export function Feature({ icon: Icon, title, text, index = 0 }: { icon: LucideIcon; title: string; text: string; index?: number }) {
  return (
    <article className="feature" style={{ "--i": index } as CSSProperties}>
      <span className="icon-tile" aria-hidden>
        <Icon />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

/** One card of the statistics: icon tile, the label above a large number, a line below, the last days as small bars. */
export function Stat({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  spark,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  sub: ReactNode;
  spark: ReactNode;
  /** position, for the staggered entrance */
  index?: number;
}) {
  return (
    <div className="stat" style={{ "--i": index } as CSSProperties}>
      <span className="icon-tile" aria-hidden>
        <Icon />
      </span>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value}
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
        <div className="stat-sub">{sub}</div>
      </div>
      {spark}
    </div>
  );
}

/** Small bars of the last days, each at least a stub so an empty day still shows its slot. */
export function Spark({ values, accent, title }: { values: number[]; accent: boolean; title?: string }) {
  const max = Math.max(0, ...values);
  return (
    <span className={accent ? "spark spark-accent" : "spark"} title={title} aria-hidden>
      {values.map((v, i) => (
        <i key={i} style={{ height: `${max > 0 ? Math.max(14, (v / max) * 100) : 14}%` }} />
      ))}
    </span>
  );
}

/** Spark in the loading state: gray stubs in a fixed rhythm. */
export function SparkSkeleton() {
  return (
    <span className="spark" aria-hidden>
      {[40, 55, 35, 60, 50, 70, 85].map((h, i) => (
        <i key={i} className="skeleton-bar" style={{ height: `${h}%` }} />
      ))}
    </span>
  );
}

/** Green dot with a ping ring while `on`; gray and still otherwise. */
export function LiveDot({ on }: { on: boolean }) {
  return <span className={on ? "live-dot live-dot-on" : "live-dot"} aria-hidden />;
}

/** A placeholder bar inside an element of the real text style, so the loaded text takes exactly its place. */
export function Skeleton({ width, style }: { width: string; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width, ...style }} aria-hidden />;
}
