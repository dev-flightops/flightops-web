import { redirect } from "next/navigation";

/**
 * A new flight log starts on the e-log page, which holds the form (audit
 * 1110-04: /flight-crew/logs/new was a 404).
 */
export default function NewFlightLogPage() {
  redirect("/flight-crew/elog");
}
