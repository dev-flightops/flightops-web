"use client";

import { useRouter } from "next/navigation";

import { segment, segmentGroup } from "@/components/ff/controls";

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
  // ForeFlight's segmented control (#80).
  return (
    <div role="group" aria-label="Card density" className={segmentGroup}>
      {(["compact", "expanded"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          aria-pressed={active === v}
          className={segment(active === v)}
        >
          {v === "compact" ? "Compact" : "Expanded"}
        </button>
      ))}
    </div>
  );
}
