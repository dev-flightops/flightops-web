import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  AirmanRecordResponse,
  DisqualificationListResponse,
  DisqualificationResponse,
} from "@/lib/api/types";

import { AirmanRecordCard } from "./airman-record-card";

/**
 * The 135.63(a)(4) record.
 *
 * The assertion this file exists for is the difference between zero and
 * absent. Someone reads this screen to decide whether a pilot is
 * qualified for the duty they are about to be assigned, and "0.0 hours"
 * and "we never wrote it down" are opposite answers to that question. A
 * dash is ambiguous between the two, which is why the component says the
 * words.
 */

function record(
  over: Partial<AirmanRecordResponse> = {},
): AirmanRecordResponse {
  return {
    pilot: { id: "p-1", full_name: "Alice Chen", email: "a@x.test" },
    certificate_type: null,
    certificate_number: null,
    ratings: [],
    medical_class: null,
    total_time_hours: null,
    pic_time_hours: null,
    cross_country_hours: null,
    night_hours: null,
    instrument_hours: null,
    experience_as_of: null,
    notes: null,
    ...over,
  } as AirmanRecordResponse;
}

function disqualification(
  over: Partial<DisqualificationResponse> & { id: string },
): DisqualificationResponse {
  return {
    kind: "physical",
    reason: "Medical deferred pending cardiology review",
    disqualified_on: "2026-06-01",
    released_on: null,
    released_by: null,
    notes: null,
    ...over,
  } as DisqualificationResponse;
}

const list = (
  items: DisqualificationResponse[] = [],
): DisqualificationListResponse => ({
  items,
  open_count: items.filter((d) => d.released_on === null).length,
});

const renderCard = (
  r: AirmanRecordResponse = record(),
  d: DisqualificationListResponse = list(),
) => render(<AirmanRecordCard record={r} disqualifications={d} />);

describe("zero is not the same as absent", () => {
  it("says a missing figure is not recorded, rather than dashing it", () => {
    renderCard();
    // Five hour fields, plus certificate type, number, ratings and
    // medical class.
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(
      9,
    );
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("renders a genuine zero as a number", () => {
    // The whole point. A pilot with no night time recorded and a pilot
    // with zero night hours are different claims, and this screen is
    // where somebody acts on the difference.
    renderCard(
      record({
        night_hours: "0",
        total_time_hours: "0.0",
        experience_as_of: "2026-08-01",
      }),
    );
    expect(screen.getAllByText("0.0").length).toBe(2);
  });

  it("formats hours to a single decimal", () => {
    renderCard(
      record({ total_time_hours: "5210.4", experience_as_of: "2026-08-01" }),
    );
    expect(screen.getByText("5210.4")).toBeInTheDocument();
  });
});

describe("certificate", () => {
  it("looks the type and medical class up rather than printing the enum", () => {
    renderCard(
      record({ certificate_type: "airline_transport", medical_class: "first" }),
    );
    expect(screen.getByText("Airline Transport")).toBeInTheDocument();
    expect(screen.getByText("First Class")).toBeInTheDocument();
    expect(screen.queryByText("airline_transport")).not.toBeInTheDocument();
  });

  it("falls back to the raw value for something outside the catalogue", () => {
    // Better than a blank cell if the server ever grows a value this
    // build does not know about.
    renderCard(record({ certificate_type: "flight_engineer" }));
    expect(screen.getByText("flight_engineer")).toBeInTheDocument();
  });

  it("shows ratings as their certificate abbreviations, expanded on hover", () => {
    renderCard(record({ ratings: ["amel", "cfii"] }));
    expect(screen.getByText("amel")).toHaveAttribute(
      "title",
      "Airplane Multi-Engine Land",
    );
    expect(screen.getByText("cfii")).toHaveAttribute(
      "title",
      "Certificated Flight Instructor — Instrument",
    );
  });

  it("does not print a snake_case slug on a multi-word rating", () => {
    // Found by looking at the page. AMEL and CFII are the abbreviations
    // the certificate itself prints, so rendering the code raw reads
    // correctly for them — and the earlier tests only used those two.
    // `instrument_airplane` is a slug, and beside two real abbreviations
    // it read as a database value that had leaked onto the screen.
    renderCard(
      record({ ratings: ["instrument_airplane", "rotorcraft_helicopter"] }),
    );
    expect(screen.getByText("instrument airplane")).toBeInTheDocument();
    expect(screen.getByText("rotorcraft helicopter")).toBeInTheDocument();
    expect(screen.queryByText(/_/)).not.toBeInTheDocument();
  });

  it("keeps the full expansion on the tooltip either way", () => {
    renderCard(record({ ratings: ["instrument_airplane"] }));
    expect(screen.getByText("instrument airplane")).toHaveAttribute(
      "title",
      "Instrument — Airplane",
    );
  });
});

describe("aeronautical experience", () => {
  it("shows the date the totals were established", () => {
    // Hours with no date attached are refused server-side; the date is
    // part of the claim, not decoration.
    renderCard(
      record({ total_time_hours: "100.0", experience_as_of: "2026-08-01" }),
    );
    expect(screen.getByText("As of Aug 1, 2026")).toBeInTheDocument();
  });

  it("renders that date as the day given, in any host zone", () => {
    for (const tz of ["UTC", "Asia/Tokyo", "America/Anchorage"]) {
      const previous = process.env.TZ;
      process.env.TZ = tz;
      const { unmount } = renderCard(
        record({ experience_as_of: "2026-08-01" }),
      );
      expect(
        screen.getByText("As of Aug 1, 2026"),
        `date shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      unmount();
      process.env.TZ = previous;
    }
  });
});

describe("disqualifications", () => {
  it("warns at the top when the pilot is currently disqualified", () => {
    // Ninth field down is the wrong place for this.
    renderCard(record(), list([disqualification({ id: "d-1" })]));
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/Currently disqualified/);
    expect(banner).toHaveTextContent(/cardiology review/);
  });

  it("does not warn when every disqualification has been released", () => {
    renderCard(
      record(),
      list([
        disqualification({
          id: "d-1",
          released_on: "2026-07-15",
          released_by: { id: "u-9", full_name: "Bob Henderson" } as never,
        }),
      ]),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps released records visible, with the date and who released them", () => {
    // 135.63 asks for the date of release. A list showing only what is
    // still open cannot answer the question the rule is about.
    renderCard(
      record(),
      list([
        disqualification({
          id: "d-1",
          released_on: "2026-07-15",
          released_by: { id: "u-9", full_name: "Bob Henderson" } as never,
        }),
      ]),
    );
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Released")).toBeInTheDocument();
    expect(row).toHaveTextContent("Disqualified Jun 1, 2026");
    expect(row).toHaveTextContent("Released Jul 15, 2026");
    expect(row).toHaveTextContent("by Bob Henderson");
  });

  it("still renders a released record whose releaser is no longer a user", () => {
    // released_by_user_id is ON DELETE SET NULL — the release still
    // happened, so the row must not disappear or crash.
    renderCard(
      record(),
      list([
        disqualification({
          id: "d-1",
          released_on: "2026-07-15",
          released_by: null,
        }),
      ]),
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Released Jul 15, 2026");
    expect(row).not.toHaveTextContent("by ");
  });

  it("marks open and released rows differently", () => {
    renderCard(
      record(),
      list([
        disqualification({ id: "d-open" }),
        disqualification({
          id: "d-closed",
          reason: "Failed line check",
          released_on: "2026-03-01",
          released_by: { id: "u-9", full_name: "Bob Henderson" } as never,
        }),
      ]),
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  it("counts the open records when there is more than one", () => {
    renderCard(
      record(),
      list([
        disqualification({ id: "d-1" }),
        disqualification({ id: "d-2", reason: "Second" }),
      ]),
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 open records");
  });

  it("says so plainly when there are none", () => {
    renderCard();
    expect(
      screen.getByText(/No disqualifications recorded/i),
    ).toBeInTheDocument();
  });
});

describe("notes", () => {
  it("shows them when present and omits the block when not", () => {
    const { unmount } = renderCard(record({ notes: "Type rating pending" }));
    expect(screen.getByText("Type rating pending")).toBeInTheDocument();
    unmount();

    renderCard();
    expect(screen.queryByText("Type rating pending")).not.toBeInTheDocument();
  });
});
