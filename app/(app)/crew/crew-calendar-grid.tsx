"use client";

import { Fragment, useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";

import {
  DUTY_TYPE_LABELS,
  DUTY_TYPES,
  type CrewCalendar,
  type CrewCalendarMember,
  type DutyType,
  type RosterEntry,
  type ScheduleTag,
} from "@/lib/api/crew-calendar";
import { formatIsoDay, todayIsoDay } from "@/lib/iso-day";
import { cn } from "@/lib/utils";

import { paintDaysAction } from "./actions";
import { AssignmentDialog, type AssignmentTarget } from "./assignment-dialog";
import { daysBetween, monthDays, monthOf, rowSegments } from "./calendar-math";
import { MoveBaseDialog } from "./move-base-dialog";
import { ManageTagsDialog, NewTagDialog } from "./tag-dialogs";
import { TagLegend, TagPalette, type PaintTool } from "./tag-palette";
import { shortTagLabel, TAG_TONE } from "./tag-tones";

/** A press-and-drag across one pilot's days, before it is painted. */
interface Drag {
  userId: string;
  anchor: string;
  current: string;
}

const dayKey = (userId: string, iso: string) => `${userId}|${iso}`;

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

  // ---- Day tags (#44) ----
  const [tool, setTool] = useState<PaintTool>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [paintError, setPaintError] = useState<string | null>(null);
  // Painted days shown before the server confirms them; dropped when the
  // refreshed calendar arrives, and undone if the server refuses.
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());
  const [, startPaint] = useTransition();
  useEffect(() => setPending(new Map()), [calendar.cells]);

  const tagById = useMemo(
    () => new Map<string, ScheduleTag>(calendar.tags.map((t) => [t.id, t])),
    [calendar.tags],
  );
  const savedTags = useMemo(
    () => new Map(calendar.cells.map((c) => [dayKey(c.user_id, c.cell_date), c.tag_id])),
    [calendar.cells],
  );
  const tagOn = (userId: string, iso: string): ScheduleTag | null => {
    const key = dayKey(userId, iso);
    const id = pending.has(key) ? pending.get(key) : savedTags.get(key);
    return id ? (tagById.get(id) ?? null) : null;
  };

  function paint(userId: string, a: string, b: string, tagId: string | null) {
    const run = daysBetween(a, b);
    const mark = (value: (iso: string) => string | null | undefined) =>
      setPending((prev) => {
        const next = new Map(prev);
        for (const iso of run) {
          const v = value(iso);
          if (v === undefined) next.delete(dayKey(userId, iso));
          else next.set(dayKey(userId, iso), v);
        }
        return next;
      });
    mark(() => tagId);
    setPaintError(null);
    startPaint(async () => {
      const outcome = await paintDaysAction(userId, run[0], run[run.length - 1], tagId);
      if (!outcome.ok) {
        mark(() => undefined);
        setPaintError(outcome.error);
      }
    });
  }

  const toolTagId = tool?.kind === "tag" ? tool.tagId : null;
  // Commit a drag wherever the button is released, even off the grid.
  useEffect(() => {
    if (!drag || !tool) return;
    const finish = () => {
      paint(drag.userId, drag.anchor, drag.current, toolTagId);
      setDrag(null);
    };
    window.addEventListener("mouseup", finish, { once: true });
    return () => window.removeEventListener("mouseup", finish);
  }, [drag, tool, toolTagId]);

  const inDrag = (userId: string, iso: string) =>
    drag !== null &&
    drag.userId === userId &&
    iso >= (drag.anchor < drag.current ? drag.anchor : drag.current) &&
    iso <= (drag.anchor < drag.current ? drag.current : drag.anchor);

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

      {canEdit ? (
        <TagPalette
          tags={calendar.tags}
          tool={tool}
          onToolChange={(next) => {
            setTool(next);
            setPaintError(null);
          }}
          onNewTag={() => setNewTagOpen(true)}
          onManage={() => setManageOpen(true)}
          error={paintError}
        />
      ) : (
        <TagLegend tags={calendar.tags} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[170px] bg-card px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Crew
              </th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  scope="col"
                  className={cn(
                    "min-w-[30px] px-0.5 py-1 text-center font-normal",
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
                  <Fragment key={member.user_id}>
                  <tr>
                    <th
                      scope="row"
                      rowSpan={2}
                      className="sticky left-0 z-10 border-b border-border/60 bg-card px-3 py-1 text-left font-medium"
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
                  <tr className="border-b border-border/60">
                    {days.map((d) => (
                      <TagCell
                        key={d.iso}
                        member={member}
                        iso={d.iso}
                        weekend={d.weekend}
                        tag={tagOn(member.user_id, d.iso)}
                        canEdit={canEdit}
                        tool={tool}
                        toolTag={toolTagId ? (tagById.get(toolTagId) ?? null) : null}
                        previewing={inDrag(member.user_id, d.iso)}
                        onDragStart={() =>
                          setDrag({ userId: member.user_id, anchor: d.iso, current: d.iso })
                        }
                        onDragOver={() =>
                          setDrag((prev) =>
                            prev && prev.userId === member.user_id ? { ...prev, current: d.iso } : prev,
                          )
                        }
                        onPaintDay={() => paint(member.user_id, d.iso, d.iso, toolTagId)}
                        onClearDay={() => paint(member.user_id, d.iso, d.iso, null)}
                      />
                    ))}
                  </tr>
                  </Fragment>
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
      <NewTagDialog open={newTagOpen} onClose={() => setNewTagOpen(false)} />
      <ManageTagsDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        tags={calendar.tags}
      />
    </>
  );
}

/**
 * One day on a pilot's tag line. With a tool picked, a press starts a
 * run, dragging across the row extends it, and releasing paints it;
 * Enter or Space paints just this day. Right-click clears a tagged day,
 * as in legacy.
 */
function TagCell({
  member,
  iso,
  weekend,
  tag,
  canEdit,
  tool,
  toolTag,
  previewing,
  onDragStart,
  onDragOver,
  onPaintDay,
  onClearDay,
}: {
  member: CrewCalendarMember;
  iso: string;
  weekend: boolean;
  tag: ScheduleTag | null;
  canEdit: boolean;
  tool: PaintTool;
  toolTag: ScheduleTag | null;
  previewing: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onPaintDay: () => void;
  onClearDay: () => void;
}) {
  const interactive = canEdit && tool !== null;
  const chip = cn(
    "flex h-5 w-full items-center justify-center overflow-hidden rounded border text-[0.55rem] font-semibold",
    tag ? TAG_TONE[tag.tone] : "border-transparent",
  );
  const day = formatIsoDay(iso);
  return (
    <td
      className={cn("px-0.5 pb-1", weekend && "bg-muted/60")}
      onMouseDown={
        interactive
          ? (e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              onDragStart();
            }
          : undefined
      }
      onMouseEnter={interactive ? onDragOver : undefined}
      onContextMenu={
        canEdit && tag
          ? (e) => {
              e.preventDefault();
              onClearDay();
            }
          : undefined
      }
    >
      {interactive ? (
        <button
          type="button"
          title={tag?.label}
          aria-label={
            tool?.kind === "eraser"
              ? `Clear ${member.full_name}'s ${day}${tag ? ` (${tag.label})` : ""}`
              : `Paint ${toolTag?.label ?? "tag"} on ${member.full_name}'s ${day}`
          }
          onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPaintDay();
            }
          }}
          className={cn(
            chip,
            !tag && "border-dashed border-border/70",
            previewing && "ring-2 ring-primary",
          )}
        >
          {tag ? shortTagLabel(tag.label) : ""}
        </button>
      ) : (
        <span title={tag?.label} className={chip}>
          {tag ? shortTagLabel(tag.label) : ""}
        </span>
      )}
    </td>
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
