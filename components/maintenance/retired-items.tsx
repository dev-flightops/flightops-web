import type { ReactNode } from "react";

/**
 * The open items on retired aircraft, below a cross-fleet list and closed
 * at first (audit 1110-16; lib/maintenance/retired.ts).
 */
export function RetiredItems({
  count,
  noun,
  tails,
  children,
}: {
  count: number;
  /** What the items are, singular: "MEL item", "squawk". */
  noun: string;
  tails: string[];
  children: ReactNode;
}) {
  return (
    <details className="mt-6 rounded-lg border border-border bg-muted/60">
      <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground">
        {`${count} ${noun}${count === 1 ? " is" : "s are"} on retired aircraft (${tails.join(", ")}), kept with their records. Nothing flies a retired aircraft.`}
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
