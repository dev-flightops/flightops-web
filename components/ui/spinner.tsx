import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Standard loading spinner — lucide Loader2 with the Tailwind
 * `animate-spin` utility. Three sizes track the rest of the UI scale
 * (xs in inline subtitles, sm next to button text, md in large
 * placeholder panels). The Spinner is purely visual, so it carries
 * `aria-hidden`; callers should provide a `<span class="sr-only">`
 * with the loading message when context matters.
 */
const SIZE_CLASS = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

export type SpinnerSize = keyof typeof SIZE_CLASS;

export function Spinner({
  size = "sm",
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <Loader2
      className={cn("animate-spin", SIZE_CLASS[size], className)}
      aria-hidden
    />
  );
}

/**
 * Centred spinner + label in a panel-sized box. Used by Suspense
 * fallback / map-loading / generic "fetching…" states so they share
 * one visual language across the app.
 */
export function LoadingPanel({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-card/40 text-xs text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="md" className="text-status-blue" />
      <span>{label}</span>
    </div>
  );
}
