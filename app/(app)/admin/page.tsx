import { redirect } from "next/navigation";

/**
 * `/admin` is no FlightOps page: the Admin department starts at the
 * dashboards, where Home's Admin tile goes, and company settings are under
 * Settings. The client's audit (1110-03, 10 Nov) typed it and got a 404.
 */
export default function AdminPage() {
  redirect("/dashboards");
}
