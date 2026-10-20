"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent } from "react";

/**
 * Native <select> dropdown for the station dashboard — matches legacy
 * peregrineflight which uses a single full-list dropdown rather than
 * filtered chips. Sticking to a server-rendered server component for
 * the rest of the page; only this picker needs to be a client island
 * so onChange can navigate.
 */
export function StationPicker({
  current,
  options,
}: {
  current: string;
  options: { icao: string; label: string }[];
}) {
  const router = useRouter();

  const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next && next !== current) {
      router.push(`/dashboards/station/?station=${next}`);
    }
  };

  return (
    <label className="flex items-center gap-2">
      <span className="eyebrow">Station</span>
      <select
        value={current}
        onChange={onChange}
        className="ff-input w-auto cursor-pointer py-1.5 text-xs"
        aria-label="Select station"
      >
        {options.map((o) => (
          <option key={o.icao} value={o.icao} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
