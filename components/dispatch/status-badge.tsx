import { cn } from "@/lib/utils";
import type { FlightStatus } from "@/lib/api/types";

const STATUS_STYLES: Record<FlightStatus, string> = {
  scheduled: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  released: "border-green-500/30 bg-green-500/10 text-green-400",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-400",
  completed: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

export function StatusBadge({
  status,
  className,
}: {
  status: FlightStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
