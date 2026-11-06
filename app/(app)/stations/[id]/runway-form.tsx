"use client";

import { useId, useState, useTransition } from "react";

import { linkCaps } from "@/components/ff/controls";
import type { FaaRunway, FaaRunways } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";
import { formatFaaDate, runwayFigures } from "@/lib/stations/runway";

import { setStationRunwayAction } from "./actions";

/**
 * The runway the company flies at this station (#50). With nothing entered
 * the dispatch risk matrix uses AWC's record or the FAA's airport file
 * (#171), and scores a stop neither knows as HIGH. An entry takes their
 * place, and the file's figures are here to fill it in.
 */
export function StationRunwayForm({
  station,
  faa = null,
}: {
  station: StationListItem;
  faa?: FaaRunways | null;
}) {
  const [length, setLength] = useState(station.runway_length_ft?.toString() ?? "");
  const [width, setWidth] = useState(station.runway_width_ft?.toString() ?? "");
  const [name, setName] = useState(station.runway_primary_name ?? "");
  const [heading, setHeading] = useState(station.runway_true_alignment_deg?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const ids = { length: useId(), width: useId(), name: useId(), heading: useId() };
  const entered = station.runway_source === "manual";
  const known = faa?.runways ?? [];

  function fillFrom(runway: FaaRunway) {
    setLength(String(runway.length_ft));
    setWidth(String(runway.width_ft));
    setName(runway.name);
    setHeading(runway.true_alignment_deg?.toString() ?? "");
    setMessage(null);
  }

  function submit(clear: boolean) {
    setMessage(null);
    const number = (text: string) => (text.trim() === "" ? null : Number(text));
    const payload = clear
      ? { length_ft: null, width_ft: null, primary_name: null, true_alignment_deg: null }
      : {
          length_ft: number(length),
          width_ft: number(width),
          primary_name: name.trim() || null,
          true_alignment_deg: number(heading),
        };
    startTransition(async () => {
      const result = await setStationRunwayAction(station.id, payload);
      if (result.ok) {
        if (clear) {
          setLength("");
          setWidth("");
          setName("");
          setHeading("");
        }
        setMessage({ ok: true, text: clear ? "Runway cleared." : "Runway saved." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Couldn't save — try again." });
      }
    });
  }

  const input = "ff-input w-full";
  const label =
    "field-label";
  return (
    <section
      aria-labelledby={`${ids.name}-heading`}
      className="mb-6 rounded-lg border border-border bg-card p-4"
    >
      <h2 id={`${ids.name}-heading`} className="text-sm font-semibold text-foreground">
        Runway for the dispatch risk matrix
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {known.length > 0
          ? "With nothing entered here, the risk matrix uses the FAA's figures. Enter the runway you use to score this stop on that one alone; a blank heading takes the FAA's figure for it."
          : "The FAA's airport file has no runway for this airport. A stop whose runway isn't known scores HIGH, so enter the runway you use here."}
        {entered ? " This one was entered by hand." : ""}
      </p>
      {known.length > 0 ? (
        <div className="mt-3">
          <p className="field-label">
            {faa?.effective ? `FAA airport file, ${formatFaaDate(faa.effective)}` : "FAA airport file"}
          </p>
          <ul className="mt-1 space-y-1">
            {known.map((runway) => (
              <li key={runway.name} className="flex flex-wrap items-baseline gap-x-3 text-xs">
                <span className="font-mono text-foreground">{runwayFigures(runway)}</span>
                <button
                  type="button"
                  className={linkCaps}
                  aria-label={`Use the FAA's figures for runway ${runway.name}`}
                  onClick={() => fillFrom(runway)}
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <div>
          <label htmlFor={ids.heading} className={label}>
            Heading (° true)
          </label>
          <input
            id={ids.heading}
            type="number"
            min={0}
            max={360}
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className={input}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className="btn-caps rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-60 text-[0.72rem]"
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
