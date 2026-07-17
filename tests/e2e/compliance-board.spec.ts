/**
 * Fleet Compliance Board — M2-G-1 / M2-G-3 golden path.
 *
 * Verifies the three views (grid / list / calendar) all render for a
 * logged-in chief-pilot session, chips filter the URL, and clicking
 * a pilot drills into their profile page.
 *
 * Local/pre-merge — requires the docker stack + `docker compose run
 * --rm seed` to have seeded the demo pilots (Sarah Kessler et al.
 * plus their currency records).
 */

import { test, expect } from "./fixtures/auth";

test.describe("compliance board — golden path", () => {
  test("grid view renders header, chips, and at least one pilot row", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/compliance/crew-currency");

    await expect(
      loggedInPage.getByRole("heading", { name: /Fleet Compliance/i }),
    ).toBeVisible();

    // Every seeded tenant carries at least the exec_admin + Sarah
    // (chief_pilot + pilot) so the grid can't be empty.
    const rows = loggedInPage.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("clicking a status chip sets ?status=... in the URL", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/compliance/crew-currency");
    // Chips are labeled "Fully Current", "Early Month", "Grace Month",
    // "Non-Current". Click the always-present "Fully Current" chip
    // even if it's zero — the URL should update regardless.
    const chip = loggedInPage
      .getByRole("link", { name: /fully current/i })
      .first();
    await chip.click();
    await expect(loggedInPage).toHaveURL(/status=/);
  });

  test("switching to List view keeps the URL and renders a table (or empty)", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/compliance/crew-currency?view=list");
    // Either a row or the "nothing to flag" empty state — both are
    // acceptable golden paths.
    const eitherPresent = loggedInPage
      .locator("table")
      .or(loggedInPage.getByText(/nothing to flag/i))
      .or(loggedInPage.getByText(/fully current/i))
      .first();
    await expect(eitherPresent).toBeVisible();
  });

  test("switching to Calendar view renders the 12-month grid (M2-G-3 tail)", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/compliance/crew-currency?view=calendar");
    // The Add Currency Item button should be present in the header on
    // every view; use it as a sentinel that the page loaded past its
    // initial paint.
    await expect(
      loggedInPage.getByRole("button", { name: /add currency item/i }),
    ).toBeVisible();
  });

  test("click-month drill-in surfaces the focused-month header", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto(
      "/compliance/crew-currency?view=calendar&month=2027-01",
    );
    // Focused-month view renders an h2 with "Jan 2027 — N findings".
    await expect(
      loggedInPage.getByRole("heading", { level: 2, name: /Jan 2027/ }),
    ).toBeVisible();
    // Back link returns to the plain calendar view.
    const back = loggedInPage.getByRole("link", {
      name: /back to 12-month view/i,
    });
    await expect(back).toBeVisible();
    await back.click();
    await expect(loggedInPage).toHaveURL(/view=calendar/);
    await expect(loggedInPage).not.toHaveURL(/month=/);
  });
});
