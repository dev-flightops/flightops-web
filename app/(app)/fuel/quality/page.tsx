import Link from "next/link";

import { AddFuelQualityTestDialog } from "@/components/fuel/quality/add-test-dialog";
import { ApiError } from "@/lib/api/client";
import {
  listFuelQualityTests,
  listFuelTypes,
} from "@/lib/api/ground";
import type {
  FuelQualityResult,
  FuelQualityTestKind,
  FuelQualityTestResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

/**
 * /fuel/quality — Fuel Quality Log (M2-G-fuel-quality-log).
 *
 * Append-only Part 135 compliance log. Lists fuel sump tests +
 * supplier bulk samples newest first; failures are color-coded so the
 * safety officer can triage at a glance. "Failures only" filter
 * narrows the table to anything that wasn't a clean pass.
 *
 * No edit / delete by design — corrections happen by filing a new
 * test with a `notes` reference. Matches the audit shape used by
 * fuel order status log + flight assignment.
 */

const TEST_KIND_LABELS: Record<FuelQualityTestKind, string> = {
  sump: "Sump",
  supplier_bulk: "Supplier",
  tank_calibration: "Calibration",
  other: "Other",
};

const RESULT_LABELS: Record<FuelQualityResult, string> = {
  pass: "Pass",
  fail: "Fail",
  contamination_water: "Water",
  contamination_particulate: "Particulate",
};

export default async function FuelQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ failures?: string; base?: string }>;
}) {
  const { failures: failuresRaw, base: baseRaw } = await searchParams;
  const onlyFailures = failuresRaw === "true";
  const baseFilter = baseRaw?.trim().toUpperCase() || null;

  let tests: FuelQualityTestResponse[] = [];
  let fuelTypes: FuelTypeResponse[] = [];
  let loadError: string | null = null;
  try {
    const [testsResp, fuelTypesResp] = await Promise.all([
      listFuelQualityTests({
        onlyFailures,
        baseCode: baseFilter ?? undefined,
        limit: 100,
      }),
      listFuelTypes(),
    ]);
    tests = testsResp.items;
    fuelTypes = fuelTypesResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Fuel quality log unavailable. Try refreshing in a moment.";
  }

  const failuresInView = tests.filter((t) => t.result !== "pass").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/ground-ops" className="hover:text-foreground">
          Ground Ops
        </Link>
        <span className="px-1.5">/</span>
        <Link href="/fuel" className="hover:text-foreground">
          Fuel
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Quality Log</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Fuel Quality Log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sump checks + supplier bulk samples. Part 135 compliance log
            — append-only, no edits.
          </p>
        </div>
        <AddFuelQualityTestDialog fuelTypes={fuelTypes} />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/fuel/quality"
          className={
            onlyFailures
              ? "rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted/40"
              : "rounded-md border border-status-blue bg-status-blue/15 px-2.5 py-1 text-xs font-semibold text-status-blue"
          }
        >
          All tests
        </Link>
        <Link
          href="/fuel/quality?failures=true"
          className={
            onlyFailures
              ? "rounded-md border border-status-red bg-status-red/15 px-2.5 py-1 text-xs font-semibold text-status-red"
              : "rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted/40"
          }
        >
          Failures only
        </Link>
        {failuresInView > 0 && !onlyFailures && (
          <span className="text-[0.7rem] text-status-yellow">
            {failuresInView} of {tests.length} failed — review the failures
            view
          </span>
        )}
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && tests.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {onlyFailures
              ? "No failed tests on file. Clean run."
              : "No tests logged yet. Click + Log Test to file the first one."}
          </p>
        </div>
      )}

      {tests.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-left">Tested</th>
                <th scope="col" className="px-4 py-2 text-left">Where</th>
                <th scope="col" className="px-4 py-2 text-left">Kind</th>
                <th scope="col" className="px-4 py-2 text-left">Findings</th>
                <th scope="col" className="px-4 py-2 text-left">Result</th>
                <th scope="col" className="px-4 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr
                  key={t.id}
                  className={
                    t.result === "pass"
                      ? "border-b border-border align-top last:border-b-0 hover:bg-muted/10"
                      : "border-b border-border align-top bg-status-red/[0.04] last:border-b-0 hover:bg-status-red/[0.08]"
                  }
                >
                  <td className="px-4 py-3 text-[0.75rem] text-muted-foreground">
                    {formatStamp(t.tested_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold">{t.base_code}</div>
                    {t.n_number && (
                      <div className="text-[0.7rem] text-muted-foreground">
                        {t.n_number}
                      </div>
                    )}
                    {t.fuel_type_label_snapshot && (
                      <div className="text-[0.7rem] text-muted-foreground">
                        {t.fuel_type_label_snapshot}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[0.75rem]">
                    {TEST_KIND_LABELS[t.test_kind]}
                  </td>
                  <td className="px-4 py-3 text-[0.75rem]">
                    <Findings test={t} />
                    {t.notes && (
                      <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
                        {t.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ResultChip result={t.result} />
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-muted-foreground">
                    {t.tested_by_name ?? t.tested_by?.full_name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Findings({ test }: { test: FuelQualityTestResponse }) {
  if (!test.water_detected && !test.particulates_detected) {
    return <span className="text-status-green">Clean sample</span>;
  }
  const parts: string[] = [];
  if (test.water_detected) parts.push("Water");
  if (test.particulates_detected) parts.push("Particulates");
  return (
    <span className="font-semibold text-status-red">
      {parts.join(" + ")}
    </span>
  );
}

function ResultChip({ result }: { result: FuelQualityResult }) {
  const palette: Record<FuelQualityResult, string> = {
    pass: "border-status-green/40 bg-status-green/10 text-status-green",
    fail: "border-status-red/40 bg-status-red/10 text-status-red",
    contamination_water:
      "border-status-red/40 bg-status-red/10 text-status-red",
    contamination_particulate:
      "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${palette[result]}`}
    >
      {RESULT_LABELS[result]}
    </span>
  );
}

function formatStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
