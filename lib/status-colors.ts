import tailwindConfig from "@/tailwind.config";

/**
 * The status palette as literal colour values.
 *
 * SVG `stroke` and `fill` take a colour, not a class name, so a chart
 * cannot reach the palette the way the rest of the app does. The
 * alternative — pasting hex into the chart components — is how a
 * palette drifts: the config changes, the charts do not, and nothing
 * says so.
 *
 * Read from the config itself so there is one source of truth. A
 * token that stops existing becomes undefined here rather than a
 * silently ignored class, and status-colors.test.ts asserts the ones
 * the charts depend on are present.
 */

const status = (
  tailwindConfig.theme?.extend?.colors as
    | { status?: Record<string, string> }
    | undefined
)?.status;

export const STATUS_COLORS: Record<string, string> = status ?? {};

/** Neutral ring behind a donut or gauge. Not a status colour — it is
 *  the empty part of the track, and it has to read as absence rather
 *  than as a value. */
export const CHART_TRACK = "rgba(136, 150, 167, 0.18)";
