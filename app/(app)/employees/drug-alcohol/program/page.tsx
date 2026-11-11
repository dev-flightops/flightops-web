import { auth } from "@/auth";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { listStaff } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getProgram, type Program } from "@/lib/api/drug-alcohol";
import { getComplianceSettings } from "@/lib/api/type-qualifications";
import { RELEASE_POLICY_ADMINS, hasAnyRole } from "@/lib/roles";

import { DatNav } from "../dat-nav";
import { ReleaseCard } from "../release-card";
import { ProgramForm } from "./program-form";

/**
 * /employees/drug-alcohol/program: who the DER is, the random rates, the
 * roles in the pool and the MIS form's employer details, plus the company's
 * switch that holds the release on clearance. Whoever runs the program.
 */

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  let program: Program | null = null;
  let loadError: string | null = null;
  try {
    program = await getProgram();
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 403
        ? "The program's settings are for its DER, the alternate DER and the Exec Admins."
        : "The program is unavailable. Try refreshing in a moment.";
  }
  const [staff, settings, session] = await Promise.all([
    listStaff()
      .then((s) => s.items)
      .catch(() => []),
    getComplianceSettings().catch(() => null),
    auth(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="The Program"
        back={{ href: "/employees/drug-alcohol", label: "Drug & Alcohol" }}
        description="The DER, the random rates, who's in the pool and what the MIS form's employer section says"
      />
      <DatNav active="program" />
      {loadError || !program ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The program is unavailable."}
        </Notice>
      ) : (
        <>
          {settings ? (
            <ReleaseCard settings={settings} canChange={hasAnyRole(session?.roles ?? [], RELEASE_POLICY_ADMINS)} />
          ) : null}
          <Panel title="Program Settings">
            <ProgramForm program={program} staff={staff} />
          </Panel>
        </>
      )}
    </div>
  );
}
