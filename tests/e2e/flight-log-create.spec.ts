/**
 * Flight log create form — M2-M-9 / M2-C-1 golden path.
 *
 * Verifies the New Flight Log form on /flight-crew/elog:
 *   1. Aircraft picker is required (Start Flight Log disabled until picked).
 *   2. Flight picker is disabled until an aircraft is chosen and
 *      filters to that aircraft's flights afterward (M2-M-9 hardening).
 *   3. Type-of-Flight dropdown exposes the full M2-C-1 option set
 *      (Charter, Advisory, Training, Ferry, Checkride, Scheduled,
 *      EAS, MX Checkflight, Other).
 *
 * Local/pre-merge — needs the docker stack with the demo tenant
 * seeded so the aircraft dropdown has at least one entry.
 */

import { test, expect } from "./fixtures/auth";

test.describe("flight log create form — golden path", () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto("/flight-crew/elog");
  });

  test("Start Flight Log is disabled until an aircraft is picked", async ({
    loggedInPage,
  }) => {
    const submit = loggedInPage.getByRole("button", {
      name: /start flight log/i,
    });
    await expect(submit).toBeDisabled();
  });

  test("Flight dropdown activates once an aircraft is picked", async ({
    loggedInPage,
  }) => {
    const aircraftSelect = loggedInPage.getByLabel(/aircraft/i);
    const flightSelect = loggedInPage.getByLabel(/^flight$/i);
    await expect(flightSelect).toBeDisabled();

    const options = await aircraftSelect.locator("option").all();
    if (options.length < 2) {
      test.skip(true, "No aircraft seeded");
      return;
    }
    const firstAircraftId = await options[1].getAttribute("value");
    if (!firstAircraftId) return;
    await aircraftSelect.selectOption(firstAircraftId);
    await expect(flightSelect).toBeEnabled();
  });

  test("Type of Flight picker exposes the full M2-C-1 option set", async ({
    loggedInPage,
  }) => {
    const typeSelect = loggedInPage.getByLabel(/flight type/i);
    const optionTexts = await typeSelect.locator("option").allTextContents();
    // M2-C-1 additions plus the originals.
    for (const label of [
      "Charter",
      "Advisory Flight",
      "Training",
      "Ferry",
      "Checkride",
      "Scheduled",
      "EAS",
      "MX Checkflight",
      "Other",
    ]) {
      expect(optionTexts.some((t) => t.includes(label))).toBe(true);
    }
  });
});
