import { auth } from "@/auth";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import {
  getCheckInConfig,
  listCheckInFields,
  type CheckInConfig,
  type CheckInCustomField,
} from "@/lib/api/check-in";
import { ApiError } from "@/lib/api/client";
import { CHECKIN_CONFIG, hasAnyRole } from "@/lib/roles";

import { CheckInSettings } from "./check-in-settings";

export const dynamic = "force-dynamic";

/**
 * /settings/check-in — legacy `templates/checkin/config.html` (#103).
 *
 * What gate check-in must capture, the no-show fee, standby and walk-ups,
 * whether closing boarding locks the manifest, and the company's own
 * fields. The settings existed as ground's API with no screen; the
 * check-in page reads them.
 */
export default async function CheckInSettingsPage() {
  let config: CheckInConfig | null = null;
  let fields: CheckInCustomField[] = [];
  let loadError: string | null = null;
  try {
    [config, fields] = await Promise.all([getCheckInConfig(), listCheckInFields()]);
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `The check-in settings could not be loaded (HTTP ${err.status}).`
        : "The check-in settings could not be loaded.";
  }
  const canEdit = hasAnyRole((await auth())?.roles ?? [], CHECKIN_CONFIG);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        title="Check-in"
        description="What a gate agent must capture when they check a passenger in, and how no-shows, standby, walk-ups and closing boarding work."
      />
      {config ? (
        <CheckInSettings config={config} fields={fields} canEdit={canEdit} />
      ) : (
        <Notice tone="red" label="Not loaded">
          {loadError}
        </Notice>
      )}
    </div>
  );
}
