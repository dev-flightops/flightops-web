/** Home-page brand mark + wordmark rendered on the light-gray secondary
 *  header band on /home. The wordmark strings and accent color are
 *  data-driven so the same component works for future rebrands. */

export function HomeBrandMark({
  size = 44,
  className = "",
  accent = "#AB2429",
  accentDark = "#7a1c20",
}: {
  size?: number;
  className?: string;
  accent?: string;
  accentDark?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      {/* Thin outline ring in accent color */}
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke={accent}
        strokeWidth="3"
      />
      {/* Swoosh — sweeping wing shape breaking out of the ring on the right */}
      <path
        d="M 12 34
           C 20 22, 30 18, 44 22
           C 48 23, 52 26, 55 30
           C 50 30, 46 32, 42 34
           C 46 34, 50 36, 53 38
           C 46 41, 34 42, 24 40
           C 20 39, 15 37, 12 34 Z"
        fill={accent}
      />
      {/* Feather notch above the swoosh for depth */}
      <path
        d="M 22 25 C 26 22, 32 21, 36 22 C 32 24, 27 26, 24 28 Z"
        fill={accentDark}
        opacity="0.7"
      />
    </svg>
  );
}

/** Full wordmark (mark + typography) — used in the secondary logo band.
 *  Wordmark and subtitle strings are prop-driven; callers derive them
 *  from the tenant's own name (typically first word / rest). Defaults
 *  are the product wordmark for use in previews / storybook / anywhere
 *  no tenant context exists. */
export function HomeWordmark({
  size = 40,
  wordmark = "FLIGHTOPS",
  subtitle = "PLATFORM",
  accent = "#AB2429",
  className = "",
}: {
  size?: number;
  wordmark?: string;
  subtitle?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={"inline-flex items-center gap-2.5 " + className}>
      <HomeBrandMark size={size} accent={accent} />
      <div className="leading-none">
        <div
          className="font-black tracking-tight text-[#1a1a1a]"
          style={{ fontSize: size * 0.7, letterSpacing: "-0.02em" }}
        >
          {wordmark}
        </div>
        <div
          className="font-semibold tracking-[0.28em] text-[#1a1a1a]"
          style={{ fontSize: size * 0.22, marginTop: 2 }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
