import { redirect } from "next/navigation";

/**
 * The flight log is the e-log, at /flight-crew/elog. The client's audit
 * (1110-04, 10 Nov) typed /flight-crew/logs and got a 404.
 */
export default function FlightLogsPage() {
  redirect("/flight-crew/elog");
}
