"use client";

import { useEffect, useId, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A date-and-time picker as three scrolling wheels: day, hour, minute.
 *
 * Asked for by name (client, 27 Sep): "We also simply need a scrolling
 * wheel with date and time to manually adjust our duty day." A pilot
 * correcting a duty time is usually on a phone or a tablet, where
 * typing into a date field is fiddly and a native datetime input looks
 * different on every device.
 *
 * Each wheel snaps to a row, and the row in the band is the value. It
 * turns with a mouse wheel, a finger, or the arrow keys (Page Up/Down
 * move five, Home/End to the ends), and a click on a row picks it. The
 * time is the viewer's local time, as the duty clock shows it.
 */

const ROW = 32; // px
const VISIBLE_ROWS = 5; // the middle one is the value

interface WheelOption {
  key: string;
  label: string;
}

function clampIndex(i: number, length: number): number {
  return Math.max(0, Math.min(length - 1, i));
}

function Wheel({
  label,
  options,
  index,
  onIndex,
}: {
  label: string;
  options: WheelOption[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  // Keep the wheel on the value when it changes from outside (a key, a
  // click, a clamp), without fighting a scroll that is still moving.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollTop - index * ROW) > 1) {
      el.scrollTop = index * ROW;
    }
  }, [index]);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  function onScroll() {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const next = clampIndex(Math.round(el.scrollTop / ROW), options.length);
      if (next !== index) onIndex(next);
    }, 120);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 5,
      PageUp: -5,
      End: options.length,
      Home: -options.length,
    };
    const move = moves[e.key];
    if (move === undefined) return;
    e.preventDefault();
    onIndex(clampIndex(index + move, options.length));
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md border-y border-primary/30 bg-primary/5"
        style={{ height: ROW }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="relative snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-md [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-scrollbar]:hidden"
        style={{ height: ROW * VISIBLE_ROWS, paddingBlock: ROW * 2 }}
      >
        {options.map((option, i) => (
          <div
            key={option.key}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => onIndex(i)}
            className={cn(
              "flex snap-center cursor-pointer select-none items-center justify-center whitespace-nowrap px-1 text-sm tabular-nums",
              i === index
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
            style={{ height: ROW }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(day: Date, today: Date): string {
  if (sameDay(day, today)) return "Today";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(day, yesterday)) return "Yesterday";
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS: WheelOption[] = Array.from({ length: 24 }, (_, h) => ({
  key: String(h),
  label: pad(h),
}));
const MINUTES: WheelOption[] = Array.from({ length: 60 }, (_, m) => ({
  key: String(m),
  label: pad(m),
}));

export function DateTimeWheel({
  label,
  value,
  onChange,
  earliest,
  latest,
}: {
  /** Names the group, e.g. "Duty in". */
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  /** The wheels offer these days, and a value outside is pulled in. */
  earliest: Date;
  latest: Date;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const last = startOfDay(latest);
    for (let d = startOfDay(earliest); d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      out.push(d);
    }
    return out;
  }, [earliest, latest]);
  const today = startOfDay(latest);
  const dayOptions = days.map((d) => ({
    key: d.toDateString(),
    label: dayLabel(d, today),
  }));

  const dayIndex = Math.max(
    0,
    days.findIndex((d) => sameDay(d, value)),
  );

  function set(nextDay: number, hour: number, minute: number) {
    const d = days[nextDay];
    let next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
    if (next > latest) next = new Date(latest);
    if (next < earliest) next = new Date(earliest);
    next.setSeconds(0, 0);
    onChange(next);
  }

  const readable = value.toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </legend>
      <div className="grid grid-cols-[1.7fr_1fr_1fr] gap-1 rounded-md border border-border bg-card p-1">
        <Wheel
          label={`${label}: day`}
          options={dayOptions}
          index={dayIndex}
          onIndex={(i) => set(i, value.getHours(), value.getMinutes())}
        />
        <Wheel
          label={`${label}: hour`}
          options={HOURS}
          index={value.getHours()}
          onIndex={(h) => set(dayIndex, h, value.getMinutes())}
        />
        <Wheel
          label={`${label}: minute`}
          options={MINUTES}
          index={value.getMinutes()}
          onIndex={(m) => set(dayIndex, value.getHours(), m)}
        />
      </div>
      <p aria-live="polite" className="mt-1 text-xs text-foreground">
        {readable} <span className="text-muted-foreground">local</span>
      </p>
    </fieldset>
  );
}
