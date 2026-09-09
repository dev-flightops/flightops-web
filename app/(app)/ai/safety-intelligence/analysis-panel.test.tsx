import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SafetyIntelligence } from "@/lib/api/ai";

const runSafetyAnalysisAction = vi.fn();
vi.mock("./actions", () => ({
  runSafetyAnalysisAction: (...a: unknown[]) => runSafetyAnalysisAction(...a),
}));

import { AnalysisPanel } from "./analysis-panel";

/**
 * The analysis half of Safety Intelligence.
 *
 * The assertions that earn their place are about honesty: the advisory
 * comes from the payload, a sampled window says so, and model output
 * is text rather than markup.
 */

function intelligence(over: Partial<SafetyIntelligence> = {}): SafetyIntelligence {
  return {
    window_start: "2026-06-11",
    window_end: "2026-09-09",
    hazard_count: 8,
    incident_count: 5,
    reports_omitted: 0,
    note: null,
    advisory: "Advisory only. Every finding needs a person to confirm it.",
    analysis: {
      executive_summary: "Ground handling dominates the window.",
      risk_categories: [{ category: "Ground Ops", count: 6, trend: "rising" }],
      hotspots: [
        { location: "PABE", report_count: 4, primary_concern: "Ramp lighting" },
      ],
      trending_issues: [
        { issue: "Unchocked equipment", frequency: "3 in 90d", risk_level: "high" },
      ],
      corrective_focus: [
        {
          area: "Ramp lighting",
          recommendation: "Restore the PANC apron lighting.",
          priority: "high",
        },
      ],
      positive_trends: ["Tool control improving at PADU"],
    },
    ...over,
  };
}

async function runWith(data: Partial<SafetyIntelligence> = {}) {
  runSafetyAnalysisAction.mockResolvedValue({
    status: "ok",
    data: intelligence(data),
  });
  render(<AnalysisPanel />);
  fireEvent.click(screen.getByRole("button", { name: /run ai analysis/i }));
  await waitFor(() => expect(runSafetyAnalysisAction).toHaveBeenCalled());
}

beforeEach(() => runSafetyAnalysisAction.mockReset());

describe("before it is run", () => {
  it("shows nothing but the button", () => {
    // The run spends a model call and takes about a minute, so it
    // happens when somebody asks for it.
    render(<AnalysisPanel />);
    expect(
      screen.getByRole("button", { name: /run ai analysis/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/executive summary/i)).not.toBeInTheDocument();
  });
});

describe("the advisory", () => {
  it("is rendered from the payload, not written into the page", async () => {
    // The service sends it on every response precisely so a client
    // cannot render the analysis without it. A page that supplies its
    // own can drop it in a refactor and nobody notices.
    await runWith({ advisory: "Bespoke advisory text from the service." });
    expect(
      await screen.findByText("Bespoke advisory text from the service."),
    ).toBeInTheDocument();
  });
});

describe("a sampled window", () => {
  it("says so when reports were left out", async () => {
    // A partial analysis that reads as a complete one is worse than no
    // analysis: it invites a decision on a picture that is missing
    // pieces nobody was told about.
    await runWith({ reports_omitted: 12 });
    expect(
      await screen.findByText(/read a sample of the window/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 reports were not included/i)).toBeInTheDocument();
  });

  it("stays quiet when the whole window was read", async () => {
    await runWith({ reports_omitted: 0 });
    await screen.findByText(/Ground handling dominates/);
    expect(
      screen.queryByText(/read a sample of the window/i),
    ).not.toBeInTheDocument();
  });

  it("gets the singular right for one omitted report", async () => {
    await runWith({ reports_omitted: 1 });
    expect(
      await screen.findByText(/1 report was not included/i),
    ).toBeInTheDocument();
  });
});

describe("what the model said", () => {
  it("renders the summary, hotspots, issues and corrective focus", async () => {
    await runWith();
    expect(
      await screen.findByText("Ground handling dominates the window."),
    ).toBeInTheDocument();
    expect(screen.getByText("PABE")).toBeInTheDocument();
    expect(screen.getByText("Unchocked equipment")).toBeInTheDocument();
    expect(
      screen.getByText("Restore the PANC apron lighting."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tool control improving at PADU/),
    ).toBeInTheDocument();
  });

  it("is text, never markup", async () => {
    // Legacy built these panels with innerHTML. The model's output is
    // derived from safety reports, which people type — so a report
    // containing markup became markup in the page. Rendering as text
    // closes that without anyone having to remember to escape.
    await runWith({
      analysis: {
        ...intelligence().analysis!,
        executive_summary: '<img src=x onerror="alert(1)">bad',
      },
    });
    const el = await screen.findByText(/bad/);
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toContain("<img");
  });

  it("shows the window the analysis actually covered", async () => {
    await runWith();
    expect(await screen.findByText("2026-06-11")).toBeInTheDocument();
    expect(screen.getByText("2026-09-09")).toBeInTheDocument();
  });
});

describe("when there is nothing to analyse", () => {
  it("shows the service's note instead of empty panels", async () => {
    // Distinct from an analysis that ran and found nothing.
    await runWith({
      analysis: null,
      note: "No reports were filed in this window.",
    });
    expect(
      await screen.findByText("No reports were filed in this window."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/executive summary/i)).not.toBeInTheDocument();
  });
});

describe("when it fails", () => {
  it("shows the reason and no analysis", async () => {
    runSafetyAnalysisAction.mockResolvedValue({
      status: "error",
      message: "The analysis was refused (HTTP 503).",
    });
    render(<AnalysisPanel />);
    fireEvent.click(screen.getByRole("button", { name: /run ai analysis/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.queryByText(/executive summary/i)).not.toBeInTheDocument();
  });

  it("distinguishes an expired session", async () => {
    runSafetyAnalysisAction.mockResolvedValue({
      status: "session_expired",
      message: "Your session has expired. Sign in again to run the analysis.",
    });
    render(<AnalysisPanel />);
    fireEvent.click(screen.getByRole("button", { name: /run ai analysis/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /session has expired/i,
    );
  });
});
