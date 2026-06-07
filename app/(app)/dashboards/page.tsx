import { redirect } from "next/navigation";

/**
 * `/dashboards` has no standalone landing page. The legacy app redirects
 * every signed-in user to a role-default dashboard immediately — exec/owner
 * to executive, director-ops to director-ops, dispatcher to dispatcher, etc.
 * (legacy modules/dashboards/router.py:61-67).
 *
 * Until RBAC lands in M4 we don't yet know each user's intended default, so
 * we route everyone to the Executive view (matches the most common "I just
 * opened the Admin section" intent). All seven role tabs are accessible
 * from the DashboardNav at the top of every dashboard page, so the user
 * can hop to any of them with one click.
 */
export default function DashboardsIndexPage() {
  redirect("/dashboards/executive");
}
