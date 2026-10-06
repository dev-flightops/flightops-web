"use client";

import type { ScheduleTag } from "@/lib/api/crew-calendar";
import { cn } from "@/lib/utils";

import { TAG_TONE } from "./tag-tones";

/** What a press on a crew day does: paint a tag, clear the day, or nothing. */
export type PaintTool = { kind: "tag"; tagId: string } | { kind: "eraser" } | null;

const PRESSED = "aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-1";

/**
 * Legacy's tag chips above the month grid. Pick one, then click a day or
 * drag across days to paint it; the Eraser clears instead.
 */
export function TagPalette({
  tags,
  tool,
  onToolChange,
  onNewTag,
  onManage,
  error,
}: {
  tags: ScheduleTag[];
  tool: PaintTool;
  onToolChange: (tool: PaintTool) => void;
  onNewTag: () => void;
  onManage: () => void;
  error: string | null;
}) {
  const active = tags.filter((t) => t.is_active);
  const painting = tool?.kind === "tag" ? active.find((t) => t.id === tool.tagId) : undefined;
  const hint =
    active.length === 0
      ? "No day tags yet. Add one, such as FLY or OFF, to paint it on crew days."
      : tool === null
        ? "Pick a tag, then click a day or drag across days. Right-click a day to clear it."
        : tool.kind === "eraser"
          ? "Click a day or drag across days to clear them."
          : `Click a day or drag across days to paint ${painting?.label ?? "the tag"}.`;

  return (
    <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Day tags
        </span>
        {active.map((t) => {
          const pressed = tool?.kind === "tag" && tool.tagId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => onToolChange(pressed ? null : { kind: "tag", tagId: t.id })}
              className={cn(
                "rounded border px-2 py-0.5 text-[0.65rem] font-semibold",
                TAG_TONE[t.tone],
                PRESSED,
              )}
            >
              {t.label}
            </button>
          );
        })}
        {active.length > 0 && (
          <button
            type="button"
            aria-pressed={tool?.kind === "eraser"}
            onClick={() => onToolChange(tool?.kind === "eraser" ? null : { kind: "eraser" })}
            className={cn(
              "rounded border border-dashed border-border px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground",
              PRESSED,
            )}
          >
            Eraser
          </button>
        )}
        <button
          type="button"
          onClick={onNewTag}
          className="rounded px-2 py-0.5 text-[0.65rem] font-semibold text-primary hover:bg-accent"
        >
          + Tag
        </button>
        {tags.length > 0 && (
          <button
            type="button"
            onClick={onManage}
            className="rounded px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Manage
          </button>
        )}
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] font-semibold text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

/** The tags, for someone who reads the calendar but doesn't edit it. */
export function TagLegend({ tags }: { tags: ScheduleTag[] }) {
  const active = tags.filter((t) => t.is_active);
  if (active.length === 0) return null;
  return (
    <ul aria-label="Day tags" className="mb-3 flex flex-wrap gap-1.5">
      {active.map((t) => (
        <li
          key={t.id}
          className={cn("rounded border px-2 py-0.5 text-[0.65rem] font-semibold", TAG_TONE[t.tone])}
        >
          {t.label}
        </li>
      ))}
    </ul>
  );
}
