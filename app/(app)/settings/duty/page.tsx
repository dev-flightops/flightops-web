import { auth } from "@/auth";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { getDutySettings } from "@/lib/api/ops";
import type { DutySettings } from "@/lib/api/types";
import { RELEASE_POLICY_ADMINS, hasAnyRole } from "@/lib/roles";

import { DutySettingsForm } from "./duty-settings";

export const dynamic = "force-dynamic";

/**
 * /settings/duty — who may correct anyone's duty times (#100).
 *
 * The operator, 22 Sep: "admin accounts are assigned to all leadership
 * and we can go in and make corrections if need be." To start, the
 * Chief Pilot, the Director of Operations and an Exec Admin.
 */
export default async function DutySettingsPage() {
  let settings: DutySettings | null = null;
  let loadError: string | null = null;
  try {
    settings = await getDutySettings();
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `The duty settings could not be loaded (HTTP ${err.status}).`
        : "The duty settings could not be loaded.";
  }
  const canEdit = hasAnyRole((await auth())?.roles ?? [], RELEASE_POLICY_ADMINS);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        title="Duty Corrections"
        description="Who may correct anyone's duty times, such as a clock-out a pilot forgot."
      />
      {settings ? (
        <DutySettingsForm correctionRoles={settings.correction_roles} canEdit={canEdit} />
      ) : (
        <Notice tone="red" label="Not loaded">
          {loadError}
        </Notice>
      )}
    </div>
  );
}
