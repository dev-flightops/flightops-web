"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import {
  DUTY_TYPE_LABELS,
  DUTY_TYPES,
  type CrewCalendar,
  type CrewCalendarMember,
  type DutyType,
  type RosterEntry,
} from "@/lib/api/crew-calendar";
import { formatIsoDay, todayIsoDay } from "@/lib/iso-day";
import { cn } from "@/lib/utils";

import { AssignmentDialog, type AssignmentTarget } from "./assignment-dialog";
import { monthDays, monthOf, rowSegments } from "./calendar-math";
import { MoveBaseDialog } from "./move-base-dialog";

/** Status tones, not red or green: a duty type is not a pass or a fail. */
export const DUTY_TONE: Record<DutyType, string> = {
  flying: "border-status-blue/40 bg-status-blue/15 text-status-blue",
  training: "border-status-purple/40 bg-status-purple/15 text-status-purple",
  standby: "border-status-yellow/40 bg-status-yellow/15 text-status-yellow",
  off: "border-status-gray/40 bg-status-gray/15 text-status-gray",
  ferry: "border-status-teal/40 bg-status-teal/15 text-status-teal",
  check: "border-status-orange/40 bg-status-orange/15 text-status-orange",
};

/** What fits in a one- or two-day block. */
const DUTY_SHORT: Record<DutyType, string> = {
  flying: "FLY",
  training: "TRN",
  standby: "SBY",
  off: "OFF",
  ferry: "FRY",
  check: "CHK",
};

export function entryLabel(entry: RosterEntry): string {
  return [
    DUTY_TYPE_LABELS[entry.duty_type],
    entry.airframe_type?.toUpperCase(),
    entry.tail_number,
    entry.station,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CrewCalendarGrid({
  calendar,
  canEdit,
}: {
  calendar: CrewCalendar;
  canEdit: boolean;
}) {
  const [target, setTarget] = useState<AssignmentTarget | null>(null);
  const [moving, setMoving] = useState<CrewCalendarMember | null>(null);
  // The viewer's own day, set after mount so the server's UTC day can't
  // disagree with it during hydration.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayIsoDay()), []);

  const days = useMemo(
    () => monthDays(calendar.first_day, calendar.last_day),
    [calendar.first_day, calendar.last_day],
  );
  const weekend = useMemo(
    () => new Set(days.filter((d) => d.weekend).map((d) => d.iso)),
    [days],
  );
  const entriesByUser = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    for (const e of calendar.entries) {
      map.set(e.user_id, [...(map.get(e.user_id) ?? []), e]);
    }
    return map;
  }, [calendar.entries]);
  const crew = calendar.groups.flatMap((g) => g.crew);
  const defaultDay =
    today && monthOf(today) === calendar.month ? today : calendar.first_day;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul aria-label="Duty types" className="flex flex-wrap gap-1.5">
          {DUTY_TYPES.map((d) => (
            <li
              key={d}
              className={cn(
                "rounded border px-2 py-0.5 text-[0.65rem] font-semibold",
                DUTY_TONE[d],
              )}
            >
              {DUTY_TYPE_LABELS[d]}
            </li>
          ))}
        </ul>
        {canEdit && (
          <button
            type="button"
            onClick={() => setTarget({ kind: "new" })}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark"
          >
            + Add Assignment
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[180px] bg-card px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Crew
              </th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  scope="col"
                  className={cn(
                    "min-w-[34px] px-0.5 py-1 text-center font-normal",
                    d.weekend && "bg-muted/60",
                    d.iso === today && "text-primary",
                  )}
                >
                  <span className="block text-[0.55rem] uppercase text-muted-foreground">
                    {d.weekday}
                  </span>
                  <span className={cn("block font-semibold", d.iso === today && "underline")}>
                    {d.day}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.groups.map((group) => (
              <Fragment key={group.station ?? "none"}>
                <tr className="border-b border-border bg-muted/60">
                  <th
                    scope="colgroup"
                    colSpan={days.length + 1}
                    className="sticky left-0 px-3 py-1.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-foreground"
                  >
                    {group.label}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {group.crew.length} crew
                    </span>
                  </th>
                </tr>
                {group.crew.map((member) => (
                  <tr key={member.user_id} className="border-b border-border/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card px-3 py-1 text-left font-medium"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{member.full_name}</span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setMoving(member)}
                            aria-label={`Move ${member.full_name} to another base`}
                            className="shrink-0 text-[0.6rem] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Move
                          </button>
                        )}
                      </span>
                    </th>
                    {rowSegments(
                      entriesByUser.get(member.user_id) ?? [],
                      calendar.first_day,
                      calendar.last_day,
                    ).map((seg) =>
                      seg.kind === "entry" ? (
                        <td key={seg.entry.id} colSpan={seg.span} className="px-0.5 py-1">
                          <EntryBlock
                            entry={seg.entry}
                            member={member}
                            span={seg.span}
                            continuesBefore={seg.continuesBefore}
                            continuesAfter={seg.continuesAfter}
                            onOpen={canEdit ? () => setTarget({ kind: "edit", entry: seg.entry }) : undefined}
                          />
                        </td>
                      ) : (
                        <td
                          key={seg.iso}
                          className={cn("px-0.5 py-1", weekend.has(seg.iso) && "bg-muted/60")}
                        >
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setTarget({ kind: "new", userId: member.user_id, day: seg.iso })
                              }
                              aria-label={`Add an assignment for ${member.full_name} on ${formatIsoDay(seg.iso)}`}
                              className="h-7 w-full rounded text-muted-foreground opacity-0 hover:bg-accent hover:opacity-100 focus-visible:opacity-100"
                            >
                              +
                            </button>
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AssignmentDialog
        target={target}
        onClose={() => setTarget(null)}
        crew={crew}
        stations={calendar.stations}
        airframeTypes={calendar.airframe_types}
        aircraft={calendar.aircraft}
        defaultDay={defaultDay}
      />
      <MoveBaseDialog
        member={moving}
        onClose={() => setMoving(null)}
        stations={calendar.stations}
      />
    </>
  );
}

function EntryBlock({
  entry,
  member,
  span,
  continuesBefore,
  continuesAfter,
  onOpen,
}: {
  entry: RosterEntry;
  member: CrewCalendarMember;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  onOpen?: () => void;
}) {
  const label = entryLabel(entry);
  const dates = `${formatIsoDay(entry.start_date)} – ${formatIsoDay(entry.end_date)}`;
  const title = [label, dates, entry.notes].filter(Boolean).join("\n");
  const className = cn(
    "flex h-7 w-full items-center overflow-hidden whitespace-nowrap rounded border px-1.5 text-[0.65rem] font-semibold",
    DUTY_TONE[entry.duty_type],
    continuesBefore && "rounded-l-none border-l-0",
    continuesAfter && "rounded-r-none border-r-0",
  );
  const text = span >= 3 ? label : DUTY_SHORT[entry.duty_type];
  if (!onOpen) {
    return (
      <div className={className} title={title}>
        {text}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      aria-label={`${member.full_name}: ${label}, ${dates}. Edit`}
      className={cn(className, "hover:brightness-95")}
    >
      {text}
    </button>
  );
}
