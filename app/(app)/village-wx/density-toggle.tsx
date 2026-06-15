"use client";

import { useRouter } from "next/navigation";

/**
 * Compact / Expanded density toggle. Server reads the URL param, server
 * component renders the right card variant — this client only updates
 * the URL.
 */
export function DensityToggle({ active }: { active: "compact" | "expanded" }) {
  const router = useRouter();
  const set = (next: "compact" | "expanded") => {
    const qs = next === "compact" ? "" : "?density=expanded";
    router.push(`/village-wx${qs}`);
  };
  return (
    <div
      role="group"
      aria-label="Card density"
      className="inline-flex overflow-hidden rounded-md border border-border bg-card"
    >
      <button
        type="button"
        onClick={() => set("compact")}
        aria-pressed={active === "compact"}
        className={
          active === "compact"
            ? "border-r border-border bg-status-blue px-3 py-1 text-xs font-semibold text-white"
            : "border-r border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/40"
        }
      >
        Compact
      </button>
      <button
        type="button"
        onClick={() => set("expanded")}
        aria-pressed={active === "expanded"}
        className={
          active === "expanded"
            ? "bg-status-blue px-3 py-1 text-xs font-semibold text-white"
            : "px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/40"
        }
      >
        Expanded
      </button>
    </div>
  );
}
