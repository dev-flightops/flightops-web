import type { BriefSegment } from "@/lib/api/ai";
import { CHART_TRACK, STATUS_COLORS } from "@/lib/status-colors";

/**
 * The two chart shapes the brief needs, as inline SVG.
 *
 * No charting library: a donut is an arc per segment and a gauge is a
 * half one, and pulling a dependency in for that would cost more than
 * it saves — the artifact CSP aside, every chart on this page is
 * static and unlabelled beyond its own centre text.
 *
 * Both are aria-hidden with the real numbers rendered as text
 * alongside, because a ring of coloured arcs tells a screen reader
 * nothing.
 */

/** Segment colours in the order the API returns them, so the legend
 *  and the ring cannot disagree. Keyed by label rather than index —
 *  an index would silently recolour everything if a segment were
 *  added. */
export const SEGMENT_COLOR: Record<string, string> = {
  // Flights
  Released: STATUS_COLORS.green,
  Planned: STATUS_COLORS.blue,
  Completed: STATUS_COLORS.gray,
  Cancelled: STATUS_COLORS.red,
  // Fleet
  Available: STATUS_COLORS.green,
  "In Maintenance": STATUS_COLORS.yellow,
  Grounded: STATUS_COLORS.red,
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: BriefSegment[];
  centerValue: number | string;
  centerLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  // An empty ring still has to draw something, or the card reads as
  // broken rather than as a quiet day.
  let offset = 0;
  const arcs =
    total > 0
      ? segments
          .filter((s) => s.count > 0)
          .map((s) => {
            const length = (s.count / total) * CIRCUMFERENCE;
            const arc = {
              label: s.label,
              dash: `${length} ${CIRCUMFERENCE - length}`,
              offset: -offset,
            };
            offset += length;
            return arc;
          })
      : [];

  return (
    <div className="relative flex items-center justify-center">
      <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden>
        <circle
          cx="55"
          cy="55"
          r={RADIUS}
          fill="none"
          stroke={CHART_TRACK}
          strokeWidth="10"
        />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx="55"
            cy="55"
            r={RADIUS}
            fill="none"
            stroke={SEGMENT_COLOR[a.label] ?? STATUS_COLORS.gray}
            strokeWidth="10"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            // Start at twelve o'clock rather than three.
            transform="rotate(-90 55 55)"
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums">{centerValue}</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function Legend({ segments }: { segments: BriefSegment[] }) {
  const shown = segments.filter((s) => s.count > 0);
  if (shown.length === 0) {
    return (
      <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">
        Nothing scheduled
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
      {shown.map((s) => (
        <li
          key={s.label}
          className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-sm"
            style={{
              background: SEGMENT_COLOR[s.label] ?? STATUS_COLORS.gray,
            }}
          />
          {s.label} {s.count}
        </li>
      ))}
    </ul>
  );
}

/** Half-ring, 0–100. Legacy draws load factor this way. */
export function Gauge({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  // Half a circumference is the full sweep of a semicircle.
  const sweep = CIRCUMFERENCE / 2;
  const filled = (clamped / 100) * sweep;

  return (
    <div className="relative flex items-end justify-center">
      <svg width="130" height="72" viewBox="0 0 110 60" aria-hidden>
        <g transform="rotate(180 55 55)">
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            fill="none"
            stroke={CHART_TRACK}
            strokeWidth="9"
            strokeDasharray={`${sweep} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
          />
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            fill="none"
            stroke={STATUS_COLORS.blue}
            strokeWidth="9"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <span className="absolute bottom-0 text-2xl font-bold tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}
