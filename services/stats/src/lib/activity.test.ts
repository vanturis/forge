import { describe, expect, it } from "vitest";
import { localHours, weekdayMeans } from "./activity";

describe("activity", () => {
  it("shifts the UTC hours into the visitor's day, both ways around midnight", () => {
    const utc = Array.from({ length: 24 }, (_, h) => h);
    // Berlin in winter: 13:00 UTC is 14:00 there, 23:00 UTC is midnight.
    expect(localHours(utc, 1)[14]).toBe(13);
    expect(localHours(utc, 1)[0]).toBe(23);
    // New York in winter: 02:00 UTC is 21:00 the evening before.
    expect(localHours(utc, -5)[21]).toBe(2);
    expect(localHours(utc, 0)).toEqual(utc);
  });

  it("averages per weekday, Monday first", () => {
    const means = weekdayMeans([
      { day: "2026-11-09", value: 10 }, // Monday
      { day: "2026-11-16", value: 30 }, // Monday
      { day: "2026-11-15", value: 7 }, // Sunday
    ]);
    expect(means).toEqual([20, 0, 0, 0, 0, 0, 7]);
  });
});
