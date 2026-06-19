import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Admin-portal gate (M2-X-1).
 *
 * Per Phil's review: any role whose Admin Access toggle is on can reach
 * `/dashboards/*`. Anyone else gets bounced back to `/home`. The toggle
 * UI lives at `/settings/permissions`; the gate value rides in the JWT
 * as `session.admin_access`, minted server-side at login time so a
 * runtime change requires the user to sign out + back in.
 *
 * Wrapping the whole `/dashboards/*` tree in this layout means we don't
 * need to repeat the check on every dashboard page. Pages that should be
 * accessible without Admin Access (none today) would need to opt out by
 * living outside this layout.
 */
export default async function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const adminAccess = Boolean(
    (session as unknown as { admin_access?: boolean } | null)?.admin_access,
  );
  if (!adminAccess) {
    redirect("/home");
  }
  return <>{children}</>;
}
