import { Badge } from "@/components/ui/badge";
import type { FlightStatus } from "@/lib/api/types";

// Maps each flight status to one of the legacy `.badge-*` palette entries
// so the dispatch list reads consistently with weather and risk indicators.
const STATUS_VARIANT: Record<
  FlightStatus,
  "blue" | "green" | "red" | "gray"
> = {
  scheduled: "blue",
  released: "green",
  cancelled: "red",
  completed: "gray",
};

export function StatusBadge({
  status,
  className,
}: {
  status: FlightStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {status}
    </Badge>
  );
}
