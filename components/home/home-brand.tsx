import { cn } from "@/lib/utils";

/** The brand mark — ring and swoosh in the tenant's brand colour.
 *
 *  Filled through `fill-primary` rather than a `fill` attribute: SVG
 *  presentation attributes are not CSS, so a CSS variable in one never
 *  resolves. That is also why this used to hardcode Peregrine crimson,
 *  which every tenant would have got regardless of their own colour. */
export function HomeBrandMark({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        className="stroke-primary"
        strokeWidth="3"
      />
      <path
        d="M 12 34
           C 20 22, 30 18, 44 22
           C 48 23, 52 26, 55 30
           C 50 30, 46 32, 42 34
           C 46 34, 50 36, 53 38
           C 46 41, 34 42, 24 40
           C 20 39, 15 37, 12 34 Z"
        className="fill-primary"
      />
      <path
        d="M 22 25 C 26 22, 32 21, 36 22 C 32 24, 27 26, 24 28 Z"
        className="fill-brand-dark"
        opacity="0.7"
      />
    </svg>
  );
}

/** Mark + wordmark, for the brand band. The strings come from the
 *  tenant's own name (first word / the rest); the defaults are the
 *  product's, for previews and anywhere with no tenant context. */
export function HomeWordmark({
  size = 40,
  wordmark = "FLIGHTOPS",
  subtitle = "PLATFORM",
  className = "",
}: {
  size?: number;
  wordmark?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <HomeBrandMark size={size} />
      <div className="leading-none text-foreground">
        <div
          className="font-black"
          style={{ fontSize: size * 0.7, letterSpacing: "-0.02em" }}
        >
          {wordmark}
        </div>
        {subtitle ? (
          <div
            className="font-semibold tracking-[0.28em]"
            style={{ fontSize: size * 0.22, marginTop: 2 }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
