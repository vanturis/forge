// When FORGE is used: by time of day and by weekday.

/** The hours of the visitor's day: `utc` is indexed by the UTC hour, `offset` the zone's whole hours ahead of UTC. */
export function localHours<T>(utc: T[], offset: number): T[] {
  return Array.from({ length: 24 }, (_, h) => utc[(((h - offset) % 24) + 24) % 24]!);
}

/** Mean per weekday (0 is Monday) over the given UTC days; a weekday without a day is 0. */
export function weekdayMeans(days: Array<{ day: string; value: number }>): number[] {
  const sum = Array<number>(7).fill(0);
  const count = Array<number>(7).fill(0);
  for (const d of days) {
    const i = (new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7;
    sum[i]! += d.value;
    count[i]! += 1;
  }
  return sum.map((s, i) => (count[i] ? s / count[i]! : 0));
}
