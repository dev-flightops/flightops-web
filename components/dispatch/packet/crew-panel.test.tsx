import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignCrewAction, unassignCrewAction, refresh } = vi.hoisted(() => ({
  assignCrewAction: vi.fn(),
  unassignCrewAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/(app)/dispatch/crew-actions", () => ({
  assignCrewAction,
  unassignCrewAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import type { CrewAssignment } from "@/lib/api/crew-assignments";

import { CrewPanel, type CrewCandidate } from "./crew-panel";

const CANDIDATES: CrewCandidate[] = [
  {
    pilot: { id: "u-ann", full_name: "Ann Pilot", email: "ann@t.local" },
    status: "early_month",
  },
  {
    pilot: { id: "u-bo", full_name: "Bo Pilot", email: "bo@t.local" },
    status: "non_current",
  },
  {
    pilot: { id: "u-cy", full_name: "Cy Pilot", email: "cy@t.local" },
    status: "grace_month",
  },
];

function assignment(over: Partial<CrewAssignment> = {}): CrewAssignment {
  return {
    id: "a-1",
    flight_id: "f-1",
    user: CANDIDATES[0].pilot,
    crew_role: "pic",
    assigned_at: "2026-08-21T10:00:00Z",
    assigned_by: null,
    notes: null,
    pic_compliance: null,
    ...over,
  } as CrewAssignment;
}

function renderPanel(assignments: CrewAssignment[] = []) {
  return render(
    <CrewPanel flightId="f-1" assignments={assignments} candidates={CANDIDATES} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  assignCrewAction.mockResolvedValue({ ok: true });
  unassignCrewAction.mockResolvedValue({ ok: true });
});

describe("CrewPanel", () => {
  it("warns when there is no PIC", () => {
    // A flight cannot legally depart without one. Saying so here beats
    // letting the release step be the first to mention it.
    renderPanel();
    expect(screen.getByText(/no pic assigned/i)).toBeInTheDocument();
  });

  it("drops the warning once a PIC is on the roster", () => {
    renderPanel([assignment()]);
    expect(screen.queryByText(/no pic assigned/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ann Pilot")).toBeInTheDocument();
  });

  it("owns SIC and cabin crew but not PIC", () => {
    // PIC is picked in Flight Details above — legacy calls its
    // equivalent the "SINGLE CONSOLIDATED PILOT FIELD ... only way to
    // pick a pilot", and a second PIC dropdown here would leave a
    // dispatcher guessing which one counts. It still SHOWS below,
    // read-only; a crew list missing its captain is not a crew list.
    renderPanel();
    expect(screen.queryByLabelText("Assign PIC")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Assign SIC")).toBeInTheDocument();
    expect(screen.getByLabelText("Assign Flight Attendant")).toBeInTheDocument();
  });

  it("points at the picker when no PIC is assigned", () => {
    renderPanel();
    expect(
      screen.getByText(/pick a PIC in Flight Details above/i),
    ).toBeInTheDocument();
  });

  it("shows the assigned PIC read-only, with their currency", () => {
    // Legacy had no cabin crew and a free-text SIC box resolved against
    // nothing; both are real people here.
    renderPanel([assignment()]);
    expect(screen.getByText("Ann Pilot")).toBeInTheDocument();
    expect(screen.getByText("Fully current")).toBeInTheDocument();
  });

  it("assigns the picked pilot to the picked seat", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Assign SIC"), {
      target: { value: "u-bo" },
    });
    await waitFor(() =>
      expect(assignCrewAction).toHaveBeenCalledWith("f-1", "u-bo", "sic"),
    );
  });

  it("shows currency next to each candidate without blocking any of them", () => {
    // Rostering ahead of a check ride is ordinary planning; flying is
    // what release refuses. A non-current pilot stays selectable, and
    // says why.
    renderPanel();
    const sic = screen.getByLabelText("Assign SIC") as HTMLSelectElement;
    const nonCurrent = Array.from(sic.options).find((o) => o.value === "u-bo");
    expect(nonCurrent?.textContent).toMatch(/NON-CURRENT/);
    expect(nonCurrent?.disabled).toBe(false);
  });

  it("does not offer someone who already holds another seat", async () => {
    // One person, one seat. Offering Ann as SIC while she is PIC invites
    // a move by side effect; taking her out of PIC should be deliberate.
    renderPanel([assignment()]);
    const sic = screen.getByLabelText("Assign SIC") as HTMLSelectElement;
    const values = Array.from(sic.options).map((o) => o.value);
    expect(values).not.toContain("u-ann");
    expect(values).toContain("u-bo");
  });

  it("removes a crew member", async () => {
    renderPanel([assignment({ crew_role: "sic" })]);
    fireEvent.click(
      screen.getByRole("button", { name: /Remove Ann Pilot as SIC/i }),
    );
    await waitFor(() =>
      expect(unassignCrewAction).toHaveBeenCalledWith("f-1", "u-ann"),
    );
  });

  it("shows the server's own words when it refuses", async () => {
    // The backend writes these to be actionable — naming the incumbent
    // tells the dispatcher who to stand down. Replacing it with
    // "Conflict" would send them hunting.
    assignCrewAction.mockResolvedValue({
      ok: false,
      error: "Ann Pilot is already PIC on PGR900. Remove them first.",
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText("Assign SIC"), {
      target: { value: "u-bo" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Ann Pilot is already PIC on PGR900/,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes on success so the rest of the packet sees the change", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Assign SIC"), {
      target: { value: "u-ann" },
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("ignores the placeholder option", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Assign SIC"), {
      target: { value: "" },
    });
    expect(assignCrewAction).not.toHaveBeenCalled();
  });
});
