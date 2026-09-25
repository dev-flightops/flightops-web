"use client";

import { useState, useTransition } from "react";

import { exportHousingReportAction } from "./actions";

/**
 * CSV export, matching legacy's per-tab "Export CSV" button.
 *
 * Legacy exports by scraping the rendered table
 * (`exportTable('occ-table', ...)`). This asks the server to rebuild
 * the report instead, because the table shows em-dashes where a value
 * is not computable and scraping those would put "—" in a numeric
 * column. Building from the data leaves the cell empty.
 */
export function ExportButton({
  tab,
  from,
  to,
  disabled = false,
}: {
  tab: "occupancy" | "history" | "cost";
  from: string;
  to: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onExport() {
    setError(null);
    start(async () => {
      const result = await exportHousingReportAction(tab, from, to);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `housing_${tab}_${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 100);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onExport}
        disabled={disabled || pending}
        className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Exporting…" : "Export CSV"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[0.7rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
