import Link from "next/link";

import { segment, segmentGroup } from "@/components/ff/controls";

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">
            Fuel Quality Log
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Sump checks + supplier bulk samples. Part 135 compliance log
            — append-only, no edits.
          </p>
        </div>
        <AddFuelQualityTestDialog fuelTypes={fuelTypes} />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* The filter as a segmented control (#83). */}
        <div className={segmentGroup}>
          <Link
            href="/fuel/quality"
            aria-current={onlyFailures ? undefined : "page"}
            className={segment(!onlyFailures)}
          >
            All tests
          </Link>
          <Link
            href="/fuel/quality?failures=true"
            aria-current={onlyFailures ? "page" : undefined}
            className={segment(onlyFailures)}
          >
            Failures only
          </Link>
        </div>
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
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && tests.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
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
            <thead className="ff-thead">
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
                      ? "border-b border-border align-top last:border-b-0 hover:bg-accent"
                      : "border-b border-border align-top shadow-[inset_3px_0_0_rgb(var(--status-red))] last:border-b-0 hover:bg-accent"
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
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">
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
    pass: "text-status-green",
    fail: "text-status-red",
    contamination_water:
      "text-status-red",
    contamination_particulate:
      "text-status-red",
  };
  return (
    <span
      className={`status-mark text-[0.6rem] ${palette[result]}`}
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
