import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  getCapa,
  getHazard,
  getIncident,
  listCapas,
  listCapasForSource,
  listHazards,
  listIncidents,
  listMyCapas,
  listMyHazards,
  listMyIncidents,
  openCapa,
  patchHazard,
  patchIncident,
  submitHazard,
  submitIncident,
  updateCapaNotes,
  updateCapaStatus,
} from "./safety";

const mockedApiFetch = vi.mocked(apiFetch);

function _fixture() {
  return {
    id: "h1",
    category: "ground_ops" as const,
    severity: "medium" as const,
    status: "submitted" as const,
    description: "Loader forks bent.",
    immediate_action_taken: null,
    location_free_text: null,
    station: null,
    is_anonymous: false,
    reporter: null,
    triaged_at: null,
    triaged_by: null,
    closed_at: null,
    closed_by: null,
    closed_reason: null,
    created_at: "2026-07-17T14:00:00Z",
    updated_at: "2026-07-17T14:00:00Z",
  };
}

describe("safety API client", () => {
  it("listHazards passes filters through the query string", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listHazards({ status: "triaged", severity: "high", limit: 25 });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/hazards?status=triaged&severity=high&limit=25",
    );
  });

  it("listHazards omits the ? when no filters are supplied", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listHazards();
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards");
  });

  it("listMyHazards hits the /mine endpoint", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listMyHazards({ limit: 10 });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/mine?limit=10");
  });

  it("getHazard interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await getHazard("abc-123");
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/abc-123");
  });

  it("submitHazard POSTs the JSON body", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await submitHazard({
      category: "flight_ops",
      severity: "critical",
      description: "Runway incursion.",
      is_anonymous: true,
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards", {
      method: "POST",
      body: JSON.stringify({
        category: "flight_ops",
        severity: "critical",
        description: "Runway incursion.",
        is_anonymous: true,
      }),
    });
  });

  it("patchHazard PATCHes to the specific id", async () => {
    mockedApiFetch.mockResolvedValueOnce(_fixture());
    await patchHazard("h1", { status: "closed", closed_reason: "resolved" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/hazards/h1", {
      method: "PATCH",
      body: JSON.stringify({ status: "closed", closed_reason: "resolved" }),
    });
  });

  // ---- Incidents ------------------------------------------------------------

  it("listIncidents composes filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listIncidents({ category: "wildlife", severity: "high" });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/incidents?category=wildlife&severity=high",
    );
  });

  it("listMyIncidents hits /mine", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listMyIncidents();
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/incidents/mine");
  });

  it("getIncident interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getIncident("inc-123");
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/incidents/inc-123");
  });

  it("submitIncident POSTs the JSON body", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await submitIncident({
      category: "wildlife",
      severity: "high",
      occurred_at: "2026-07-17T14:00:00Z",
      description: "Bird strike on climb-out.",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/incidents", {
      method: "POST",
      body: JSON.stringify({
        category: "wildlife",
        severity: "high",
        occurred_at: "2026-07-17T14:00:00Z",
        description: "Bird strike on climb-out.",
      }),
    });
  });

  it("patchIncident PATCHes to the specific id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await patchIncident("inc-1", { status: "triaged" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/incidents/inc-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "triaged" }),
    });
  });

  // ---- CAPAs ----------------------------------------------------------------

  it("listCapas passes overdue_only as query string", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCapas({ overdue_only: true, status: "open" });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions?status=open&overdue_only=true",
    );
  });

  it("listMyCapas hits /mine", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listMyCapas();
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions/mine",
    );
  });

  it("listCapasForSource composes the /for path", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCapasForSource("hazard", "abc");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions/for/hazard/abc",
    );
  });

  it("getCapa interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getCapa("capa-1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions/capa-1",
    );
  });

  it("openCapa POSTs the JSON body", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await openCapa({
      source_type: "hazard",
      source_id: "abc",
      title: "Install bollards",
      description: "Replace ramp bollards with impact-rated ones.",
      owner_user_id: "user-1",
      due_date: "2026-08-01",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/corrective-actions", {
      method: "POST",
      body: JSON.stringify({
        source_type: "hazard",
        source_id: "abc",
        title: "Install bollards",
        description: "Replace ramp bollards with impact-rated ones.",
        owner_user_id: "user-1",
        due_date: "2026-08-01",
      }),
    });
  });

  it("updateCapaNotes PATCHes only the notes field", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateCapaNotes("c1", "Vendor contacted.");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions/c1/notes",
      {
        method: "PATCH",
        body: JSON.stringify({ notes: "Vendor contacted." }),
      },
    );
  });

  it("updateCapaStatus PATCHes to /status", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateCapaStatus("c1", {
      status: "closed",
      closed_reason: "Done.",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/safety/corrective-actions/c1/status",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "closed", closed_reason: "Done." }),
      },
    );
  });
});
