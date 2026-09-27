import { redirect } from "next/navigation";

/**
 * `/dashboards` has no standalone landing page. The legacy app redirects
 * every signed-in user to a role-default dashboard immediately — exec/owner
 * to executive, director-ops to director-ops, dispatcher to dispatcher, etc.
 * (legacy modules/dashboards/router.py:61-67).
 *
 * Until RBAC lands in M4 we don't yet know each user's intended default, so
 * we route everyone to the Executive view (matches the most common "I just
 * opened the Admin section" intent). All seven role views are in the
 * Admin department strip at the top of every dashboard page, so the user
 * can hop to any of them with one click. (Each page used to carry its own
 * tab row repeating that strip, under a banner promising role-based
 * access "soon"; both went.)
 */
export default function DashboardsIndexPage() {
  redirect("/dashboards/executive");
}
