import type { Config } from "tailwindcss";

/** A token held as HSL components, e.g. `--border: 240 6% 90%`. */
const hsl = (v: string) => `hsl(var(${v}) / <alpha-value>)`;
/** A token held as RGB channels, e.g. `--brand-rgb: 171 36 41`. */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

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
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
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
        ring: rgb("--brand-rgb"),
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
        // Aviation status. Theme-aware: light-ground values in :root,
        // the original dark-tuned values inside `.dark` islands.
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
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Legacy panels use 12px corner radius.
        xl: "0.75rem",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Legacy "overdue" pulse, used on at-risk / late items.
        "ff-pulse": "ff-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
