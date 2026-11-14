/**
 * Pixel-art accents of the start page: clusters of orange squares in the corners. Decoration only,
 * drawn from the rows below: a digit is one square, 1 to 4 from faint to full orange, a space is empty.
 */
const OPACITY: Record<string, number> = { "1": 0.22, "2": 0.42, "3": 0.68, "4": 1 };

/** Steps that rise to the right, for a bottom right corner. */
export const STEPS = ["        2", "       34", "      241", "    13423", "   242341", " 13431242"];

export function Pixels({ rows, size = 12, flip = false, className }: { rows: readonly string[]; size?: number; flip?: boolean; className?: string }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      className={className}
      width={cols * size}
      height={rows.length * size}
      viewBox={`0 0 ${cols} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (OPACITY[c] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="var(--color-accent)" opacity={OPACITY[c]} /> : null)),
      )}
    </svg>
  );
}
