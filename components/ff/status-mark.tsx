import { cn } from "@/lib/utils";

/**
 * A status, said quietly (#79, from #78's board): the word in capitals in
 * its status colour behind a small square marker. It replaces tinted pill
 * chips. The colour does the work; the marker keeps it findable for anyone
 * who cannot tell the hues apart, and the word says it outright.
 */
export type StatusTone = "green" | "yellow" | "red" | "blue" | "orange" | "purple" | "teal" | "gray" | "muted";

const TONE: Record<StatusTone, string> = {
  green: "text-status-green",
  yellow: "text-status-yellow",
  red: "text-status-red",
  blue: "text-status-blue",
  orange: "text-status-orange",
  purple: "text-status-purple",
  teal: "text-status-teal",
  gray: "text-status-gray",
  muted: "text-muted-foreground",
};

export function StatusMark({
  label,
  tone = "gray",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.1em]",
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 bg-current" />
      {label}
    </span>
  );
}
