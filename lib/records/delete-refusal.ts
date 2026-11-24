import { ApiError } from "@/lib/api/client";

export type DeleteResult = { ok: true } | { ok: false; message: string };

/**
 * What to tell someone whose delete didn't go (1119-30). The services refuse
 * a record that is part of the operation's history with a 409 whose detail
 * says why ("It departed, so it stays on record."); that sentence is shown
 * as it is.
 */
export function deleteRefusal(err: unknown, what: string): string {
  if (!(err instanceof ApiError)) return `Couldn't delete the ${what}. Please try again.`;
  if (err.status === 401) return "Your session expired — please sign in again.";
  if (err.status === 403) return `Only an Exec Admin can delete a ${what}.`;
  if (err.status === 404) return `This ${what} is already gone.`;
  if (err.status === 409) {
    try {
      const detail = JSON.parse(err.message)?.detail;
      if (typeof detail?.message === "string" && detail.message) return detail.message;
    } catch {
      /* not JSON: the generic line below */
    }
    return `This ${what} is part of the record, so it can't be deleted.`;
  }
  return `Couldn't delete the ${what}. Please try again.`;
}
