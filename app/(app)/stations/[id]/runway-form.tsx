"use client";

import { useId, useState, useTransition } from "react";

import type { StationListItem } from "@/lib/api/types";

import { setStationRunwayAction } from "./actions";

/**
 * The runway the company flies at this station (#50). The dispatch risk
 * matrix scores a stop whose runway isn't known as HIGH until it's
 * entered; the FAA data it reads covers ICAO airports but not most
 * village strips, so those are entered here, once.
 */
export function StationRunwayForm({ station }: { station: StationListItem }) {
  const [length, setLength] = useState(station.runway_length_ft?.toString() ?? "");
  const [width, setWidth] = useState(station.runway_width_ft?.toString() ?? "");
  const [name, setName] = useState(station.runway_primary_name ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ids = { length: useId(), width: useId(), name: useId() };
  const entered = station.runway_source === "manual";

  function submit(clear: boolean) {
    setMessage(null);
    const number = (text: string) => (text.trim() === "" ? null : Number(text));
    const payload = clear
      ? { length_ft: null, width_ft: null, primary_name: null }
      : {
          length_ft: number(length),
          width_ft: number(width),
          primary_name: name.trim() || null,
        };
    startTransition(async () => {
      const result = await setStationRunwayAction(station.id, payload);
      if (result.ok) {
        if (clear) {
          setLength("");
          setWidth("");
          setName("");
        }
        setMessage({ ok: true, text: clear ? "Runway cleared." : "Runway saved." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Couldn't save — try again." });
      }
    });
  }

  const input = "ff-input w-full";
  const label =
    "mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
  return (
    <section
      aria-labelledby={`${ids.name}-heading`}
      className="mb-6 rounded-lg border border-border bg-card p-4"
    >
      <h2 id={`${ids.name}-heading`} className="text-sm font-semibold text-foreground">
        Runway for the dispatch risk matrix
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The risk matrix reads runways from FAA data, which has most ICAO airports but not
        most village strips. A stop whose runway isn&rsquo;t known scores HIGH, so enter the
        runway you use here.
        {entered ? " This one was entered by hand." : ""}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label htmlFor={ids.length} className={label}>
            Length (ft)
          </label>
          <input
            id={ids.length}
            type="number"
            min={100}
            max={20000}
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor={ids.width} className={label}>
            Width (ft)
          </label>
          <input
            id={ids.width}
            type="number"
            min={10}
            max={500}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor={ids.name} className={label}>
            Runway
          </label>
          <input
            id={ids.name}
            value={name}
            maxLength={20}
            placeholder="e.g. 05/23"
            onChange={(e) => setName(e.target.value)}
            className={input}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          Save runway
        </button>
        {entered && (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            Clear
          </button>
        )}
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`text-xs ${message.ok ? "text-status-green" : "text-status-red"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
