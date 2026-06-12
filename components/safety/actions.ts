"use server";

/**
 * Safety report submission — STUB until safety-service ships in M3.
 *
 * The formal spec mandates a global Safety Report button that:
 *   1. Stores the report in a safety_reports table
 *   2. Strips user_id when "anonymous" is checked (keeps role for stats)
 *   3. Notifies the safety officer
 *
 * None of those storage paths exist yet. The action validates the
 * payload, returns success/error so the modal can render its success
 * panel, and logs to the server console so on-call has a record. When
 * safety-service lands, swap the console.log for an apiFetch POST to
 * /safety/reports and the modal UI stays unchanged.
 */

export type FileSafetyReportInput = {
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  anonymous: boolean;
};

export type FileSafetyReportResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function fileSafetyReportAction(
  input: FileSafetyReportInput,
): Promise<FileSafetyReportResult> {
  if (!input.description || input.description.trim().length < 10) {
    return {
      status: "error",
      message: "Please describe the issue in at least 10 characters.",
    };
  }
  if (!["low", "medium", "high", "critical"].includes(input.severity)) {
    return { status: "error", message: "Invalid severity." };
  }

  // Console-log placeholder. M3: replace with
  //   apiFetch("/safety/reports", { method: "POST", body: ... })
  // which strips user_id server-side when anonymous=true.
  console.log("[safety-report:stub]", {
    severity: input.severity,
    anonymous: input.anonymous,
    description_length: input.description.length,
  });

  return { status: "ok" };
}
