"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { LoadTeamResponse } from "@/lib/api/types";

import { saveTeamAction, type TeamField, type TeamFormResult } from "./actions";

export interface StationOption {
  icao: string;
  name: string;
}

export interface PersonOption {
  id: string;
  name: string;
  /** Their roles, as the Users page names them. */
  roles: string;
}

export function personLabel(p: PersonOption): string {
  return p.roles ? `${p.name} (${p.roles})` : p.name;
}

const DEFAULT_COLOR = "#60a5fa";

const LABEL =
  "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red";

/** `<input type="color">` only takes #rrggbb; the API also allows #rgb. */
function sixDigit(color: string): string {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

/**
 * Add Team / Edit Team — legacy `templates/settings/load_teams.html`'s
 * team modal: name, base, lead, colour, notes.
 *
 * Deliberate differences from legacy:
 *   - Base has no silent default. Legacy's select started on the first
 *     station and its create route fell back to PANC, so a team saved
 *     without looking went to the wrong base.
 *   - Notes can be cleared. Legacy kept the old notes when the box was
 *     emptied.
 *   - The lead picker needs the staff list, which only an Executive
 *     Admin can read. Without it the form says so and leaves the lead
 *     alone rather than offering a list it can't fill.
 */
export function TeamDialog({
  team,
  defaultBase,
  stations,
  people,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  /** Set to edit this team; left out to add one. */
  team?: LoadTeamResponse;
  /** Base preselected when adding (the "+ Add Team at PANC" buttons). */
  defaultBase?: string;
  stations: StationOption[];
  /** Null when the staff list couldn't be read (not an Executive Admin). */
  people: PersonOption[] | null;
  trigger: ReactNode;
  triggerClassName: string;
  /** Accessible name for the trigger when its text alone is ambiguous
   *  ("Edit" on every card). */
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeamFormResult | null>(null);
  const uid = useId();

  const editing = team !== undefined;
  const base = team?.base_icao ?? defaultBase ?? "";
  // The team's own base stays pickable even if it isn't a station here.
  const baseOptions =
    base && !stations.some((s) => s.icao === base)
      ? [{ icao: base, name: "" }, ...stations]
      : stations;
  // Same for its lead: a lead missing from the list (deactivated, say)
  // would otherwise show as "No lead" and be cleared on save.
  const lead = team?.team_lead ?? null;
  const leadOptions =
    people && lead && !people.some((p) => p.id === lead.id)
      ? [{ id: lead.id, name: lead.full_name, roles: "" }, ...people]
      : people;

  const fieldError = (key: TeamField) =>
    result?.status === "error" ? result.fieldErrors?.[key] : undefined;
  const errorId = (key: TeamField) => `${uid}-${key}-error`;
  const invalid = (key: TeamField) =>
    fieldError(key)
      ? { "aria-invalid": true as const, "aria-describedby": errorId(key) }
      : {};

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setResult(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const outcome = await saveTeamAction(formData);
      if (outcome.status === "ok") {
        setOpen(false);
        setResult(null);
      } else {
        setResult(outcome);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Team" : "Add Team"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Changes show on Ramp Ops and the dispatch packet straight away.`
                : "A ramp or load crew, at one base."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            {editing && <input type="hidden" name="team_id" value={team.id} />}

            {result?.status === "error" && (
              <p
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {result.message}
              </p>
            )}

            <div>
              <label htmlFor={`${uid}-name`} className={LABEL}>
                Team Name <span className="text-status-red">*</span>
              </label>
              <input
                id={`${uid}-name`}
                name="team_name"
                required
                maxLength={100}
                defaultValue={team?.team_name ?? ""}
                placeholder="e.g. Alpha Crew, Morning Shift"
                className={FIELD}
                {...invalid("team_name")}
              />
              {fieldError("team_name") && (
                <p id={errorId("team_name")} className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("team_name")}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${uid}-base`} className={LABEL}>
                Base <span className="text-status-red">*</span>
              </label>
              <select
                id={`${uid}-base`}
                name="base_icao"
                required
                defaultValue={base}
                className={FIELD}
                {...invalid("base_icao")}
              >
                {!base && <option value="">Pick a base…</option>}
                {baseOptions.map((s) => (
                  <option key={s.icao} value={s.icao}>
                    {s.name ? `${s.icao} — ${s.name}` : s.icao}
                  </option>
                ))}
              </select>
              {fieldError("base_icao") && (
                <p id={errorId("base_icao")} className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("base_icao")}
                </p>
              )}
            </div>

            <div>
              {leadOptions ? (
                <label htmlFor={`${uid}-lead`} className={LABEL}>
                  Team Lead
                </label>
              ) : (
                <p className={LABEL}>Team Lead</p>
              )}
              {leadOptions ? (
                <select
                  id={`${uid}-lead`}
                  name="team_lead_user_id"
                  defaultValue={lead?.id ?? ""}
                  className={FIELD}
                >
                  <option value="">— No Lead —</option>
                  {leadOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {lead ? lead.full_name : "No lead"}. Only an Executive Admin
                  can choose the lead.
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${uid}-color`} className={LABEL}>
                Team Color
              </label>
              <input
                id={`${uid}-color`}
                type="color"
                name="color_code"
                defaultValue={sixDigit(team?.color_code ?? DEFAULT_COLOR)}
                className="h-9 w-16 cursor-pointer rounded-md border border-border bg-background p-1"
                {...invalid("color_code")}
              />
            </div>

            <div>
              <label htmlFor={`${uid}-notes`} className={LABEL}>
                Notes
              </label>
              <textarea
                id={`${uid}-notes`}
                name="notes"
                rows={2}
                defaultValue={team?.notes ?? ""}
                placeholder="Optional notes about this team"
                className={FIELD}
                {...invalid("notes")}
              />
              {fieldError("notes") && (
                <p id={errorId("notes")} className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("notes")}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                Save Team
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
