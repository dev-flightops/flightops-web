"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { TagCell } from "@/app/(app)/crew/crew-calendar-grid";
import { daysBetween, monthDays } from "@/app/(app)/crew/calendar-math";
import { ManageTagsDialog, NewTagDialog, type TagActions } from "@/app/(app)/crew/tag-dialogs";
import { TagLegend, TagPalette, type PaintTool } from "@/app/(app)/crew/tag-palette";
import type { ScheduleTag } from "@/lib/api/crew-calendar";
import type { MxRoster, MxRosterMechanic } from "@/lib/api/mx-roster";
import { cn } from "@/lib/utils";

import { createRosterTagAction, paintRosterDaysAction, updateRosterTagAction } from "./actions";

const ROSTER_TAG_ACTIONS: TagActions = {
  create: async (label, tone) => {
    const outcome = await createRosterTagAction(label, tone);
    return outcome.ok ? { ok: true } : { ok: false, error: outcome.error };
  },
  update: async (tagId, patch) => {
    const outcome = await updateRosterTagAction(tagId, patch);
    return outcome.ok ? { ok: true } : { ok: false, error: outcome.error };
  },
  painted: "mechanics' days",
};

/** A press-and-drag across one mechanic's days, before it is painted. */
interface Drag {
  userId: string;
  anchor: string;
  current: string;
}

const dayKey = (userId: string, iso: string) => `${userId}|${iso}`;

/**
 * The Mechanic Roster's month (#178), legacy's maintenance/calendar.html: a
 * row per mechanic under their base, one tag a day. Painting works as on the
 * crew calendar: pick a tag, then press and drag across a mechanic's days;
 * right-click clears a day.
 */
export function RosterGrid({ roster, canEdit }: { roster: MxRoster; canEdit: boolean }) {
  const days = useMemo(() => monthDays(roster.first_day, roster.last_day), [roster.first_day, roster.last_day]);
  const groups = useMemo(() => {
    const map = new Map<string, MxRosterMechanic[]>();
    for (const m of roster.mechanics) {
      const base = m.station ?? "";
      map.set(base, [...(map.get(base) ?? []), m]);
    }
    return [...map.entries()];
  }, [roster.mechanics]);

  const [tool, setTool] = useState<PaintTool>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [paintError, setPaintError] = useState<string | null>(null);
  // Painted days shown before the server confirms them, as on the crew calendar.
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());
  const [, startPaint] = useTransition();
  useEffect(() => setPending(new Map()), [roster.cells]);

  const tagById = useMemo(() => new Map<string, ScheduleTag>(roster.tags.map((t) => [t.id, t])), [roster.tags]);
  const saved = useMemo(
    () => new Map(roster.cells.map((c) => [dayKey(c.user_id, c.cell_date), c.tag_id])),
    [roster.cells],
  );
  const tagOn = (userId: string, iso: string): ScheduleTag | null => {
    const key = dayKey(userId, iso);
    const id = pending.has(key) ? pending.get(key) : saved.get(key);
    return id ? (tagById.get(id) ?? null) : null;
  };

  function paint(userId: string, a: string, b: string, tagId: string | null) {
    const run = daysBetween(a, b);
    const mark = (value: string | null | undefined) =>
      setPending((prev) => {
        const next = new Map(prev);
        for (const iso of run) {
          if (value === undefined) next.delete(dayKey(userId, iso));
          else next.set(dayKey(userId, iso), value);
        }
        return next;
      });
    mark(tagId);
    setPaintError(null);
    startPaint(async () => {
      const outcome = await paintRosterDaysAction(userId, run[0], run[run.length - 1], tagId);
      if (!outcome.ok) {
        mark(undefined);
        setPaintError(outcome.error);
      }
    });
  }

  const toolTagId = tool?.kind === "tag" ? tool.tagId : null;
  const dragRef = useRef<Drag | null>(null);
  function startDrag(userId: string, iso: string) {
    const tagId = toolTagId;
    dragRef.current = { userId, anchor: iso, current: iso };
    setDrag(dragRef.current);
    window.addEventListener(
      "mouseup",
      () => {
        const run = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (run) paint(run.userId, run.anchor, run.current, tagId);
      },
      { once: true },
    );
  }
  function extendDrag(userId: string, iso: string) {
    const run = dragRef.current;
    if (!run || run.userId !== userId || run.current === iso) return;
    dragRef.current = { ...run, current: iso };
    setDrag(dragRef.current);
  }
  const inDrag = (userId: string, iso: string) =>
    drag !== null &&
    drag.userId === userId &&
    iso >= (drag.anchor < drag.current ? drag.anchor : drag.current) &&
    iso <= (drag.anchor < drag.current ? drag.current : drag.anchor);

  return (
    <>
      {canEdit ? (
        <TagPalette
          tags={roster.tags}
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
        <TagLegend tags={roster.tags} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 min-w-[170px] bg-card px-3 py-2 text-left eyebrow">
                Mechanic
              </th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  scope="col"
                  className={cn(
                    "min-w-[30px] px-0.5 py-1 text-center font-normal",
                    d.weekend && "bg-muted/60",
                    d.iso === roster.today && "text-primary",
                  )}
                >
                  <span className="block text-[0.55rem] uppercase text-muted-foreground">{d.weekday}</span>
                  <span className={cn("block font-semibold", d.iso === roster.today && "underline")}>{d.day}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([base, mechanics]) => (
              <Fragment key={base || "none"}>
                <tr className="border-b border-border bg-muted/60">
                  <th
                    scope="colgroup"
                    colSpan={days.length + 1}
                    className="sticky left-0 px-3 py-1.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-foreground"
                  >
                    {base || "No base"}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {mechanics.length} mechanic{mechanics.length === 1 ? "" : "s"}
                    </span>
                  </th>
                </tr>
                {mechanics.map((m) => (
                  <tr key={m.user_id} className="border-b border-border/60">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1 text-left font-medium">
                      <span className="block truncate">{m.full_name}</span>
                      {m.title ? <span className="block truncate text-[0.6rem] font-normal text-muted-foreground">{m.title}</span> : null}
                    </th>
                    {days.map((d) => (
                      <TagCell
                        key={d.iso}
                        member={m}
                        iso={d.iso}
                        weekend={d.weekend}
                        tag={tagOn(m.user_id, d.iso)}
                        canEdit={canEdit}
                        tool={tool}
                        toolTag={toolTagId ? (tagById.get(toolTagId) ?? null) : null}
                        previewing={inDrag(m.user_id, d.iso)}
                        onDragStart={() => startDrag(m.user_id, d.iso)}
                        onDragOver={() => extendDrag(m.user_id, d.iso)}
                        onPaintDay={() => paint(m.user_id, d.iso, d.iso, toolTagId)}
                        onClearDay={() => paint(m.user_id, d.iso, d.iso, null)}
                      />
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <NewTagDialog open={newTagOpen} onClose={() => setNewTagOpen(false)} actions={ROSTER_TAG_ACTIONS} />
      <ManageTagsDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        tags={roster.tags}
        actions={ROSTER_TAG_ACTIONS}
      />
    </>
  );
}
