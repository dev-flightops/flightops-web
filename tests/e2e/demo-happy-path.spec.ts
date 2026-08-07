/**
 * Demo happy-path smoke — mirrors the pitch-video script at
 * FlightOps/reports/pitch-video-tech-acquisition.md.
 *
 * If this spec fails, the pitch script no longer matches the deployed
 * UI and the demo will read wrong on camera. Every assertion below
 * corresponds to a stage direction or quoted line in the script:
 *
 *   - Section 2A: /reservations New Booking search form,
 *                 Search Flights fall-through to /reservations/bookings/new,
 *                 Fleet Board with real aircraft rows
 *   - Section 2B: /dispatch Flight Dispatch Packet — PIC picker with real
 *                 pilots, full panel sequence in the correct order, right-
 *                 column action buttons
 *   - Section 2C: /flight-crew Duty In card, Training Currency table with
 *                 the specific FAR citations the script references
 *
 * Run locally against docker-composed stack:
 *   docker compose up -d && npm run dev
 *   npx playwright test tests/e2e/demo-happy-path.spec.ts --workers=1
 *
 * Run against Vercel preview:
 *   E2E_BASE_URL=https://flightops-web-<preview>.vercel.app \
 *   npx playwright test tests/e2e/demo-happy-path.spec.ts --workers=1
 */

import { test, expect } from "./fixtures/auth";

// Real customers seeded in the demo tenant (both local and Vercel).
const DEMO_CUSTOMERS = [
  "Alice Northrup",
  "Bob Kalskag",
  "Cheryl Aleknagik",
  "Marcus Chen",
];

// Real pilots surfaced in the dispatch PIC picker. All 5 must appear
// or the pitch narration ("Alice Chen, Bob Henderson, Karen Rasmussen,
// Mike O'Brien, Sarah Kessler") reads wrong.
const DEMO_PILOTS = [
  "Alice Chen",
  "Bob Henderson",
  "Karen Rasmussen",
  "Mike O'Brien",
  "Sarah Kessler",
];

// Panels the pitch narration names in Section 2B, in order. Ordering
// matters — the script scrolls top-to-bottom and calls them out one
// by one. A reorder breaks the walkthrough.
// Panel section-title DOM text (visible ALL-CAPS is CSS text-transform,
// the underlying string is title-case per components/dispatch/packet/*.tsx).
const DISPATCH_PANELS_IN_ORDER = [
  "Flight Details",
  "Route",
  "Weather & ATIS",
  "Alternate Review",
  "NOTAM Acknowledgment",
  "Compliance Gates",
  "Maintenance & Airworthiness",
  "Fuel",
  "Load Team",
  "Company Risk Inputs",
  "Management Approval Triggers",
  "Non-Certified Weather Notes",
];

test.describe("demo happy path — pitch video script", () => {
  // -------- Section 2A: Reservations ---------------------------------

  test("2A /reservations shows the New Booking search form", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/reservations");
    // Wait for the customers server-fetch to finish before asserting —
    // /reservations lists all tenant customers in the picker and the
    // first test in a worker occasionally beats the fetch otherwise.
    await page.waitForLoadState("networkidle");
    // Trip Type chips — script names all three by name.
    await expect(
      page.getByRole("button", { name: /^one way$/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /^return$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /freight only/i }),
    ).toBeVisible();
    // Field labels the script names.
    // Field labels — the DOM text is title-case ("Adults", "Children",
    // etc.); the visible UPPERCASE is CSS text-transform. Assert against
    // the real DOM text.
    for (const label of [
      "Adults",
      "Children",
      "Customer",
      "Date",
      "From",
      "To",
      "Via (optional)",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // Primary button — script says "hitting Search Flights takes them
    // to the file-a-booking form".
    await expect(
      page.getByRole("button", { name: /^search flights$/i }),
    ).toBeVisible();
  });

  test("2A Search Flights falls through to /reservations/bookings/new", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/reservations");
    await page
      .getByRole("button", { name: /^search flights$/i })
      .click();
    await page.waitForURL(/\/reservations\/bookings\/new/);
    await expect(
      page.getByRole("heading", { name: /^new booking$/i }),
    ).toBeVisible();
  });

  test("2A File Booking form has the exact fields the script narrates", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/reservations/bookings/new");

    // Script: "Customer dropdown, Origin, Destination, Requested
    // Departure, Pax, Aircraft (Preferred), Quote (USD), Notes, then
    // hit File Booking."
    // DOM labels are title-case; the visible ALL-CAPS is CSS
    // text-transform. Assert against the real DOM strings.
    for (const label of [
      "Customer",
      "Origin (ICAO)",
      "Destination (ICAO)",
      "Requested departure",
      "Pax",
      "Aircraft (preferred)",
      "Quote (USD)",
      "Notes",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: /^file booking$/i }),
    ).toBeVisible();
  });

  test("2A Customer dropdown surfaces the seeded customers", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/reservations/bookings/new");
    const customerSelect = page.getByRole("combobox", { name: /customer/i });
    for (const name of DEMO_CUSTOMERS) {
      await expect(
        customerSelect.locator(`option:has-text("${name}")`),
      ).toBeAttached();
    }
  });

  test("2A Fleet Board shows Board view + real aircraft rows + filter chips", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/reservations/fleet-board");
    await expect(
      page.getByRole("heading", { name: /^fleet board$/i }),
    ).toBeVisible();
    // View toggle — script names all three.
    for (const view of ["List", "Board", "Split"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${view}$`, "i") }),
      ).toBeVisible();
    }
    // Aircraft rows — script says "a nine-seat Cessna 208 Caravan
    // tail number N100PA, and a nineteen-seat Beechcraft 1900D, N200PA".
    await expect(page.getByText(/N100PA/)).toBeVisible();
    await expect(page.getByText(/Cessna 208 Caravan/)).toBeVisible();
    await expect(page.getByText(/N200PA/)).toBeVisible();
    await expect(page.getByText(/Beechcraft 1900D/)).toBeVisible();
    // Filter chips — the "All Pilots" chip is the closest thing to
    // a crew filter on this screen.
    await expect(
      page.getByRole("button", { name: /^all bases$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^all types$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^all pilots$/i }),
    ).toBeVisible();
  });

  // -------- Section 2B: Dispatch -------------------------------------

  test("2B /dispatch shows Flight Dispatch Packet header + Flight Details", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/dispatch");
    await expect(
      page.getByRole("heading", { name: /flight dispatch packet/i }),
    ).toBeVisible();
    // Flight Details fields the script names.
    // Same rule: DOM text is title-case, visible ALL-CAPS is CSS.
    for (const label of [
      "Aircraft",
      "N-Number",
      "PIC",
      "SIC Name",
      "Area Forecast Region",
    ]) {
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("2B panel sequence appears in the correct top-to-bottom order", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/dispatch");
    // Playwright's innerText returns the CSS-transformed text (ALL-CAPS
    // via text-transform: uppercase). Lowercase both sides for the
    // includes/indexOf checks so case-vs-transform stops mattering.
    const bodyText = (await page.locator("main").innerText()).toLowerCase();
    const panels = DISPATCH_PANELS_IN_ORDER.map((p) => p.toLowerCase());
    const seen = panels.filter((p) => bodyText.includes(p));
    expect(seen).toEqual(panels);
    const offsets = panels.map((p) => bodyText.indexOf(p));
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });

  test("2B PIC picker lists all 5 real pilots", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/dispatch");
    const picSelect = page.getByRole("combobox", { name: /pilot in command/i });
    for (const name of DEMO_PILOTS) {
      await expect(
        picSelect.locator(`option:has-text("${name}")`),
      ).toBeAttached();
    }
  });

  test("2B right column shows Refresh Weather + AI Review + Generate PDF", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/dispatch");
    await expect(
      page.getByRole("button", { name: /refresh weather/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^ai review$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /generate pdf/i }),
    ).toBeVisible();
    // Generate PDF is disabled until a flight loads — script leans
    // into this as the "compliance guard-rail" story.
    await expect(
      page.getByRole("button", { name: /generate pdf/i }),
    ).toBeDisabled();
  });

  // -------- Section 2C: Flight Crew ----------------------------------

  test("2C /flight-crew shows Duty In card + My Flights Today feed", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/flight-crew");
    // DOM text: "Flight Crew" (title-case eyebrow), "DUTY IN" (literal
    // all-caps in the button component), "My Flights today" (mixed).
    await expect(page.getByText("Flight Crew", { exact: true })).toBeVisible();
    await expect(page.getByText("DUTY IN", { exact: true })).toBeVisible();
    await expect(
      page.getByText("My Flights today", { exact: true }),
    ).toBeVisible();
  });

  test("2C Training Currency table lists the FAR citations the script names", async ({
    loggedInPage: page,
  }) => {
    await page.goto("/flight-crew");
    await expect(
      page.getByText("Training currency", { exact: true }),
    ).toBeVisible();
    // Script quotes these regulation numbers explicitly.
    for (const reg of [
      "135.293",
      "135.297",
      "135.299",
      "135.301",
      "135.330",
      "135.331",
      "61.23",
      "61.57",
    ]) {
      await expect(
        page.getByText(new RegExp(escapeRegExp(reg))).first(),
      ).toBeVisible();
    }
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
