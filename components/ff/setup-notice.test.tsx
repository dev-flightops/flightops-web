import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantProvider } from "@/components/assistant/assistant-context";
import { MAX_NOTICE_CHARS, MAX_NOTICES, onScreenNotices, showOnScreen } from "@/lib/help/on-screen";
import { aircraftGaps } from "@/lib/setup/aircraft";
import type { AircraftListItem } from "@/lib/api/types";

import { LoadFailedNotice, OnScreenText, SetupNotice } from "./setup-notice";

/** #138: where work stops for want of a setting, the page says what, why,
 *  and where it's set; the assistant gets the same words. */
describe("SetupNotice", () => {
  const notice = (canFix?: boolean) => (
    <SetupNotice
      place="fleet"
      missing="N200PA’s cruise speed"
      stops="the leg times can’t fill in"
      meanwhile="Type each leg’s times."
      canFix={canFix}
    />
  );

  it("links someone who may set it", () => {
    render(notice(true));
    expect(screen.getByText("Setup needed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set it under Settings → Fleet ›" })).toHaveAttribute("href", "/settings/fleet");
  });

  it("tells anyone else who to ask", () => {
    render(notice(false));
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText(
        /N200PA’s cruise speed isn’t set, so the leg times can’t fill in\. Type each leg’s times\. Ask an Exec Admin, the Director of Operations, the Director of Maintenance or Maintenance to set it under Settings → Fleet\./,
      ),
    ).toBeInTheDocument();
  });

  it("works it out from the signed-in roles when the page doesn't say", () => {
    const { unmount } = render(<AssistantProvider name="Dee" roles={["maintenance"]}>{notice()}</AssistantProvider>);
    expect(screen.getByRole("link", { name: "Set it under Settings → Fleet ›" })).toBeInTheDocument();
    unmount();
    render(<AssistantProvider name="Pat" roles={["pilot"]}>{notice()}</AssistantProvider>);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows itself to the assistant while it's on screen", () => {
    const { unmount } = render(notice(false));
    const said =
      "Setup needed: N200PA’s cruise speed isn’t set, so the leg times can’t fill in. Type each leg’s times. " +
      "It’s done under Settings → Fleet, by an Exec Admin, the Director of Operations, the Director of Maintenance or Maintenance.";
    expect(onScreenNotices()).toContain(said);
    unmount();
    expect(onScreenNotices()).not.toContain(said);
  });

  it("takes a whole sentence and its own fix", () => {
    render(
      <SetupNotice
        place="fleet"
        sentence="No aircraft is active, so a flight can’t be opened."
        fix="make one active"
        canFix
      />,
    );
    expect(screen.getByRole("link", { name: "Make one active under Settings → Fleet ›" })).toBeInTheDocument();
  });
});

describe("LoadFailedNotice", () => {
  it("names what didn't load, or says nothing", () => {
    const { container, rerender } = render(<LoadFailedNotice what={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LoadFailedNotice what={["the crew list", "the weather"]} meaning="Release still runs every check itself." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load the crew list and the weather. Release still runs every check itself. Reload the page to try again",
    );
    expect(onScreenNotices()).toContain(
      "Couldn’t load the crew list and the weather. Release still runs every check itself. Reloading the page tries again.",
    );
  });
});

describe("OnScreenText", () => {
  it("shows short words and tells the assistant the longer ones", () => {
    render(<OnScreenText text="no fuel price at PABE (Settings → Costs)" said="Setup needed: no fuel price at PABE." />);
    expect(screen.getByText("no fuel price at PABE (Settings → Costs)")).toBeInTheDocument();
    expect(onScreenNotices()).toContain("Setup needed: no fuel price at PABE.");
  });
});

describe("what the assistant is sent", () => {
  it("is a few short notices, each once", () => {
    const off = [showOnScreen("same"), showOnScreen("same"), ...Array.from({ length: 12 }, (_, i) => showOnScreen(`n${i}`))];
    off.push(showOnScreen("x".repeat(MAX_NOTICE_CHARS + 50)));
    const sent = onScreenNotices();
    expect(sent).toHaveLength(MAX_NOTICES);
    expect(sent.filter((n) => n === "same")).toHaveLength(1);
    off.forEach((stop) => stop());
    const long = showOnScreen("y".repeat(MAX_NOTICE_CHARS + 50));
    expect(onScreenNotices()[0]).toHaveLength(MAX_NOTICE_CHARS);
    long();
    expect(onScreenNotices()).toEqual([]);
  });
});

describe("aircraftGaps", () => {
  const base: AircraftListItem = {
    id: "a",
    tail_number: "N604PA",
    model: "GA8",
    seats: 7,
    max_payload_lbs: 1600,
    is_active: true,
    make: null,
    serial_number: null,
    year: null,
    airframe_type: "ga8",
    cruise_speed_kt: 120,
  };
  it("names what a flight on the aircraft needs and it lacks", () => {
    expect(aircraftGaps(base)).toEqual([]);
    expect(aircraftGaps({ ...base, cruise_speed_kt: null, max_payload_lbs: null, airframe_type: null }).map((g) => g.what)).toEqual([
      "cruise speed",
      "useful load (max gross and empty weight)",
      "airframe type",
    ]);
  });
});
