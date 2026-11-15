import { intlLocale, type Locale } from "./i18n";

export interface Formats {
  /** "12.345" / "12,345" below a million, from there "1,2 Mio." / "1.2M". */
  count: (n: number) => string;
  /** Milliseconds as hours, one decimal below ten. */
  hours: (ms: number) => string;
  /** US cents as dollars: "3,45 $" / "$3.45" below ten dollars, whole dollars above, compact from a million. */
  usd: (cents: number) => string;
  /** Euro cents: "12,50 €" / "€12.50", whole amounts without cents, from 1000 € rounded. */
  eur: (cents: number) => string;
  /** Date and time in Berlin time: "18.10.2026, 14:30" / "Oct 18, 2026, 2:30 PM GMT+2". */
  dateTime: (iso: string) => string;
  /** "18.10." / "10/18" for the axis. */
  dayShort: (day: string) => string;
  /** "So., 18. Okt." / "Sun, Oct 18" for tooltips and tables. */
  dayLong: (day: string) => string;
  /** Short axis label: "800", "50K", "1,5M" / "1.5M", from a billion "40 Mrd." / "40B". */
  axis: (n: number) => string;
  /** Rounded share: "45 %" / "45%". */
  percent: (part: number, whole: number) => string;
  /** Share with one decimal below ten percent, so small parts do not all read "0 %"; a trace is "<0,1 %". */
  percentFine: (part: number, whole: number) => string;
  /** At most one decimal: "6,4" / "6.4". */
  decimal: (n: number) => string;
  /** Milliseconds as minutes, one decimal below ten. */
  minutes: (ms: number) => string;
  /** Hour of the day (0 to 23): "14 Uhr" / "2 PM". */
  hour: (hour: number) => string;
  /** Weekday, 0 is Monday: "Mo" / "Mon", long "Montag" / "Monday". */
  weekday: (index: number, long?: boolean) => string;
  /** "12. Nov. 2026" / "Nov 12, 2026", in Berlin time. */
  date: (iso: string) => string;
}

function build(locale: Locale): Formats {
  const l = intlLocale(locale);
  const full = new Intl.NumberFormat(l, { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(l, { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 });
  const oneDecimal = new Intl.NumberFormat(l, { maximumFractionDigits: 1 });
  const count = (n: number) => (Math.abs(n) < 1e6 ? full.format(n) : compact.format(n));

  const money = (currency: string) => ({
    cents: new Intl.NumberFormat(l, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    whole: new Intl.NumberFormat(l, { style: "currency", currency, maximumFractionDigits: 0 }),
    compact: new Intl.NumberFormat(l, { style: "currency", currency, notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }),
  });
  const usd = money("USD");
  const eur = money("EUR");

  const dateTime = new Intl.DateTimeFormat(
    l,
    // The German page says "Uhr" after it and needs no zone; the English one names it.
    locale === "de"
      ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }
      : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Europe/Berlin", timeZoneName: "short" },
  );
  const dayShort = new Intl.DateTimeFormat(l, { day: "numeric", month: "numeric", timeZone: "UTC" });
  const dayLong = new Intl.DateTimeFormat(l, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const pct = new Intl.NumberFormat(l, { style: "percent", maximumFractionDigits: 0 });
  const pctFine = new Intl.NumberFormat(l, { style: "percent", maximumFractionDigits: 1 });
  const hour = new Intl.DateTimeFormat(l, { hour: "numeric", timeZone: "UTC" });
  const weekdayShort = new Intl.DateTimeFormat(l, { weekday: "short", timeZone: "UTC" });
  const weekdayLong = new Intl.DateTimeFormat(l, { weekday: "long", timeZone: "UTC" });
  const date = new Intl.DateTimeFormat(l, { dateStyle: "medium", timeZone: "Europe/Berlin" });
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  // 2024-01-01 was a Monday.
  const monday = Date.UTC(2024, 0, 1);

  return {
    count,
    hours: (ms) => {
      const hours = ms / 3_600_000;
      return hours < 10 ? oneDecimal.format(hours) : count(Math.round(hours));
    },
    usd: (cents) => {
      const v = cents / 100;
      return v < 10 ? usd.cents.format(v) : Math.abs(v) < 1e6 ? usd.whole.format(Math.round(v)) : usd.compact.format(v);
    },
    eur: (cents) => {
      const v = cents / 100;
      const whole = Math.abs(v - Math.round(v)) < 0.005;
      if (Math.abs(v) >= 1e6) return eur.compact.format(v);
      return whole || v >= 1000 ? eur.whole.format(Math.round(v)) : eur.cents.format(v);
    },
    dateTime: (iso) => dateTime.format(new Date(iso)),
    dayShort: (d) => dayShort.format(day(d)),
    dayLong: (d) => dayLong.format(day(d)),
    axis: (n) => {
      const abs = Math.abs(n);
      if (abs < 1e3) return full.format(n);
      if (abs < 1e6) return `${oneDecimal.format(n / 1e3)}K`;
      if (abs < 1e9) return `${oneDecimal.format(n / 1e6)}M`;
      // Billions of tokens a day: "40.000M" would not fit beside the plot.
      return compact.format(n);
    },
    percent: (part, whole) => pct.format(whole ? part / whole : 0),
    percentFine: (part, whole) => {
      const share = whole ? part / whole : 0;
      if (share > 0 && share < 0.001) return `<${pctFine.format(0.001)}`;
      return share < 0.1 ? pctFine.format(share) : pct.format(share);
    },
    decimal: (n) => oneDecimal.format(n),
    minutes: (ms) => {
      const minutes = ms / 60_000;
      return minutes < 10 ? oneDecimal.format(minutes) : count(Math.round(minutes));
    },
    hour: (h) => hour.format(new Date(Date.UTC(2024, 0, 1, h))),
    weekday: (i, long) => (long ? weekdayLong : weekdayShort).format(new Date(monday + i * 86_400_000)),
    date: (iso) => date.format(new Date(iso)),
  };
}

const cache = new Map<Locale, Formats>();

export function formats(locale: Locale): Formats {
  let f = cache.get(locale);
  if (!f) {
    f = build(locale);
    cache.set(locale, f);
  }
  return f;
}
