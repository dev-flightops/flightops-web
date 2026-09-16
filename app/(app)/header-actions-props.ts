import { visibleAiTools } from "@/components/app-shell/modules";
import { dismissAlertAction } from "@/components/app-shell/notifications-actions";
import { getCurrentDuty } from "@/lib/api/ops";
import type { CurrentDutyResponse } from "@/lib/api/types";
import {
  loadUnacknowledgedAlerts,
  type UnacknowledgedAlerts,
} from "@/lib/dashboards/unacknowledged-alerts";

import { signOutAction } from "./actions";
import { clockInAction, clockOutAction } from "./duty-actions";

/**
 * Everything the top-bar action cluster needs, built once.
 *
 * WHY THIS EXISTS
 *
 * The top bar is rendered from two places. The (app) layout renders it
 * for every route; /home renders its own, because that page owns its
 * top chrome and the app shell hides its header there.
 *
 * So every prop has to be supplied twice, and three times now it was
 * supplied once:
 *
 *   - the AI tools menu, which collapsed to a single FleetBrain link
 *     on /home alone
 *   - the duty seed, which left the Clock In pill showing its disabled
 *     "unavailable" placeholder on /home alone
 *   - the notification bell, which showed "unavailable" on /home alone
 *     — the one page somebody looking at their alerts would open
 *
 * Each was found by looking at the running page. The pattern is not a
 * series of oversights; it is what a duplicated call site does. So the
 * props are assembled here and both callers spread the result, which
 * makes the fourth one impossible to miss rather than merely
 * documented.
 *
 * WHY THE FETCHES SOFT-FAIL
 *
 * A brief ops or maintenance blip should not break every page in the
 * app. Duty falls back to null, which renders the clock pill as
 * unavailable; alerts fall back to null, which disables the bell
 * rather than showing a count of zero — a zero claims the operation is
 * clear, and "we could not look" is a different statement.
 */

export interface HeaderActionsData {
  email: string;
  fullName: string | null;
  showSettings: boolean;
  signOutAction: typeof signOutAction;
  initialDuty: CurrentDutyResponse | null;
  clockInAction: typeof clockInAction;
  clockOutAction: typeof clockOutAction;
  aiTools: ReturnType<typeof visibleAiTools>;
  bellAlerts: UnacknowledgedAlerts | null;
  dismissAlertAction: typeof dismissAlertAction;
}

export async function buildHeaderActionsData(
  email: string,
  fullName: string | null,
  roles: readonly string[],
): Promise<HeaderActionsData> {
  const [initialDuty, bellAlerts] = await Promise.all([
    getCurrentDuty().catch(() => null),
    loadUnacknowledgedAlerts().catch(() => null),
  ]);

  return {
    email,
    fullName,
    // /settings is entirely company configuration, with no
    // personal-profile page behind it, so most roles have nothing to
    // do there (client request 8/25).
    showSettings: roles.length === 0 || roles.includes("exec_admin"),
    signOutAction,
    initialDuty,
    clockInAction,
    clockOutAction,
    aiTools: visibleAiTools(roles),
    bellAlerts,
    dismissAlertAction,
  };
}
