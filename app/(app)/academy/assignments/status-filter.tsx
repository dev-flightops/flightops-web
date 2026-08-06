"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
];

/**
 * Status filter chip row for the assignments roster. Uses shallow
 * URL updates so the browser back button lands on the previous
 * filter — matches the /reservations / /safety filter pattern.
 */
export function StatusFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setStatus = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => setStatus(o.value)}
            className={
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition " +
              (active
                ? "border-status-blue bg-status-blue/15 text-status-blue"
                : "border-border bg-card text-foreground/80 hover:bg-muted/20")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
