import type { Config } from "tailwindcss";

/** A token held as HSL components, e.g. `--border: 240 6% 90%`. */
const hsl = (v: string) => `hsl(var(${v}) / <alpha-value>)`;
/** A token held as RGB channels, e.g. `--brand-rgb: 171 36 41`. */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

/**
 * The brand as TEXT, borders and focus rings (#78). In dark mode one
 * colour cannot be both a fill under white text and text on navy, so
 * those utilities read `--brand-text-rgb` (the on-navy tone) while
 * `bg-primary` keeps the fill. In light mode both are the same colour.
 * See app/globals.css.
 */
const brandText = {
  primary: {
    DEFAULT: rgb("--brand-text-rgb"),
    foreground: hsl("--primary-foreground"),
  },
  brand: {
    DEFAULT: rgb("--brand-text-rgb"),
    dark: rgb("--brand-text-rgb"),
    light: rgb("--brand-light-rgb"),
    primary: rgb("--brand-text-rgb"),
    "primary-dark": rgb("--brand-text-rgb"),
  },
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // The display face: UPPERCASE heroes, page titles and captions,
        // as ForeFlight sets Gesta (#78).
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        // Every colour goes through a CSS variable declared with
        // <alpha-value>, so opacity modifiers (`bg-primary/10`,
        // `border-status-red/40`) work on all of them. See globals.css
        // for why the brand and status colours are RGB channels.
        border: hsl("--border"),
        input: hsl("--input"),
        ring: rgb("--brand-text-rgb"),
        background: hsl("--background"),
        foreground: hsl("--foreground"),
        // The single accent: the tenant's brand.
        primary: {
          DEFAULT: rgb("--brand-rgb"),
          foreground: hsl("--primary-foreground"),
        },
        secondary: {
          DEFAULT: hsl("--secondary"),
          foreground: hsl("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: hsl("--destructive"),
          foreground: hsl("--destructive-foreground"),
        },
        muted: {
          DEFAULT: hsl("--muted"),
          foreground: hsl("--muted-foreground"),
        },
        accent: {
          DEFAULT: hsl("--accent"),
          foreground: hsl("--accent-foreground"),
        },
        popover: {
          DEFAULT: hsl("--popover"),
          foreground: hsl("--popover-foreground"),
        },
        card: {
          DEFAULT: hsl("--card"),
          foreground: hsl("--card-foreground"),
        },
        // Ink — the near-black of the top bar and hero, for the few
        // places that need it outside a `.dark` island.
        ink: hsl("--ink"),
        // The top bar; the app's navy in dark mode, the site's slate in light.
        chrome: hsl("--chrome"),
        // A surface lifted off the card (dark) — the app's tile colour.
        raised: hsl("--raised"),
        inset: hsl("--inset"),
        // The brand's text tone as a fill, for thin indicators (an active
        // tab's underline) that must show on navy as text would.
        "brand-ink": rgb("--brand-text-rgb"),
        // Brand tones. `brand-primary` / `brand-primary-dark` are the
        // names the first branded buttons used; kept so they follow the
        // tenant too.
        brand: {
          DEFAULT: rgb("--brand-rgb"),
          dark: rgb("--brand-dark-rgb"),
          // Brand-coloured text on ink. A deep brand as text on
          // near-black fails contrast; this is the same hue at L71%.
          light: rgb("--brand-light-rgb"),
          primary: rgb("--brand-rgb"),
          "primary-dark": rgb("--brand-dark-rgb"),
        },
        // Aviation status, solved per mode (globals.css).
        status: {
          green: rgb("--status-green"),
          yellow: rgb("--status-yellow"),
          red: rgb("--status-red"),
          blue: rgb("--status-blue"),
          gray: rgb("--status-gray"),
          orange: rgb("--status-orange"),
          purple: rgb("--status-purple"),
          // Spec 5 §"Cell badge colors" — teal renders the EARLY MONTH
          // window, distinct from green (DUE THIS MONTH).
          teal: rgb("--status-teal"),
          // Deeper tones for a solid fill under white text (#78).
          "green-fill": rgb("--status-green-fill"),
          "yellow-fill": rgb("--status-yellow-fill"),
          "red-fill": rgb("--status-red-fill"),
          "blue-fill": rgb("--status-blue-fill"),
          "gray-fill": rgb("--status-gray-fill"),
          "orange-fill": rgb("--status-orange-fill"),
          "purple-fill": rgb("--status-purple-fill"),
          "teal-fill": rgb("--status-teal-fill"),
        },
      },
      // Tailwind 3's opacity scale moves in fives, and an off-scale
      // modifier generates no CSS at all — silently. `/8` and `/12` were
      // used 25 times, almost all for the top bar's and module nav's
      // hover and active backgrounds, none of which ever rendered.
      // Extending the scale makes them work as written.
      textColor: brandText,
      borderColor: brandText,
      divideColor: brandText,
      outlineColor: brandText,
      ringColor: { ...brandText, DEFAULT: rgb("--brand-text-rgb") },
      caretColor: brandText,
      fill: brandText,
      stroke: brandText,
      opacity: {
        8: "0.08",
        12: "0.12",
      },
      // ForeFlight's corners are square-ish (#78): 4px panels, 3px
      // controls (their buttons and fields), 2px small marks, 6px media.
      // No pill shapes.
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 2px)",
        xl: "0.375rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "ff-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        // The landing carousel's slide timer (#78).
        "ff-progress": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Legacy "overdue" pulse, used on at-risk / late items.
        "ff-pulse": "ff-pulse 1.4s ease-in-out infinite",
        "ff-progress": "ff-progress 8s linear forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
