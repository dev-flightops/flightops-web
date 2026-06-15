"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { LoadTeamResponse } from "@/lib/api/types";

import {
  assignFlightAction,
  unassignFlightAction,
  type AssignActionState,
} from "./assign-actions";

/**
 * Tiny popover dropdown attached to each flight card on /ramp-ops.
 * Replaces the M2-M-25e-gated disabled button with a working assign/
 * reassign/unassign control.
 *
 * Click the button → list of active teams (filtered to the flight's
 * origin base when possible — otherwise all teams). Picking a team
 * fires the assign action; selecting the currently-assigned team is
 * a no-op (server is idempotent). An "Unassign" option appears when
 * the flight is already on a team.
 */
export function AssignTeamDropdown({
  flightId,
  flightOrigin,
  teams,
  currentTeam,
}: {
  flightId: string;
  flightOrigin: string;
  teams: LoadTeamResponse[];
  currentTeam: LoadTeamResponse | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [assignState, doAssign, assigning] = useActionState<
    AssignActionState,
    FormData
  >(assignFlightAction, { status: "idle" });
  const [unassignState, doUnassign, unassigning] = useActionState<
    AssignActionState,
    FormData
  >(unassignFlightAction, { status: "idle" });
  const pending = assigning || unassigning;

  // Close popover on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close popover when the server action succeeds.
  useEffect(() => {
    if (assignState.status === "ok" || unassignState.status === "ok") {
      setOpen(false);
    }
  }, [assignState.status, unassignState.status]);

  // Prefer teams based at the flight's origin; if none match, show all
  // active teams so the user still has options.
  const originTeams = teams.filter(
    (t) => t.is_active && t.base_icao === flightOrigin,
  );
  const visibleTeams =
    originTeams.length > 0 ? originTeams : teams.filter((t) => t.is_active);

  const error =
    assignState.status === "error"
      ? assignState.message
      : unassignState.status === "error"
        ? unassignState.message
        : null;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={
          currentTeam
            ? "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.65rem] font-semibold hover:brightness-110 disabled:opacity-60"
            : "inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-[0.65rem] font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
        }
        style={
          currentTeam
            ? {
                borderColor: currentTeam.color_code,
                backgroundColor: `${currentTeam.color_code}22`,
                color: currentTeam.color_code,
              }
            : undefined
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {pending && <Spinner size="xs" />}
        {currentTeam ? currentTeam.team_name : "Assign team"}
        <span aria-hidden className="text-[0.5rem] opacity-70">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          {error && (
            <div
              role="alert"
              className="border-b border-border bg-status-red/10 px-3 py-2 text-[0.65rem] text-status-red"
            >
              {error}
            </div>
          )}
          {visibleTeams.length === 0 ? (
            <p className="px-3 py-2 text-[0.7rem] text-muted-foreground">
              No active teams to assign to.
            </p>
          ) : (
            <ul>
              {visibleTeams.map((t) => {
                const isCurrent = currentTeam?.id === t.id;
                return (
                  <li key={t.id}>
                    <form action={doAssign}>
                      <input type="hidden" name="flight_id" value={flightId} />
                      <input
                        type="hidden"
                        name="load_team_id"
                        value={t.id}
                      />
                      <button
                        type="submit"
                        role="menuitem"
                        disabled={pending}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[0.75rem] hover:bg-muted/40 disabled:opacity-60 ${
                          isCurrent ? "bg-muted/30 font-semibold" : ""
                        }`}
                      >
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: t.color_code }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-foreground">
                            {t.team_name}
                          </span>
                          <span className="block text-[0.65rem] text-muted-foreground">
                            {t.base_icao} · {t.member_count}{" "}
                            {t.member_count === 1 ? "member" : "members"}
                          </span>
                        </span>
                        {isCurrent && (
                          <span
                            aria-hidden
                            className="text-status-blue text-[0.7rem]"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          {currentTeam && (
            <form action={doUnassign} className="border-t border-border">
              <input type="hidden" name="flight_id" value={flightId} />
              <button
                type="submit"
                role="menuitem"
                disabled={pending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.75rem] text-status-red hover:bg-status-red/10 disabled:opacity-60"
              >
                Unassign
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
