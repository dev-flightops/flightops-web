import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const { capabilities } = vi.hoisted(() => ({ capabilities: vi.fn() }));
vi.mock("@/lib/api/ai", () => ({ getAiCapabilities: capabilities }));
vi.mock("@/lib/api/auth", () => ({ getCompanyProfile: vi.fn(async () => null) }));
vi.mock("@/lib/api/ops", () => ({ listFlights: vi.fn(async () => ({ items: [], total: 0 })) }));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({
  loadOperationalSnapshot: vi.fn(async () => null),
}));

import SystemHealthDashboardPage from "./page";

const ALL = { fleetbrain: true, morning_brief: true, ai_query: true, safety_intelligence: true, delay_alerts: true };

afterEach(cleanup);

it("reads the AI service's own answer, not the web server's environment (1124-17)", async () => {
  // It said "No API key set ... the AI tools will not answer" while they
  // answered: the key is the AI service's, never the web server's.
  capabilities.mockResolvedValueOnce(ALL);
  render(await SystemHealthDashboardPage());
  expect(screen.getByText("The AI tools are answering")).toBeInTheDocument();
  expect(screen.queryByText(/is not built/i)).toBeNull();
});

it("says when the AI service has no model key, or didn't answer", async () => {
  capabilities.mockResolvedValueOnce({ ...ALL, ai_query: false, safety_intelligence: false, delay_alerts: false });
  render(await SystemHealthDashboardPage());
  expect(screen.getByText(/The AI service has no model key/)).toBeInTheDocument();
  cleanup();
  capabilities.mockRejectedValueOnce(new Error("down"));
  render(await SystemHealthDashboardPage());
  expect(screen.getByText("The AI service didn't answer")).toBeInTheDocument();
});
