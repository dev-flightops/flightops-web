import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setRules, refresh } = vi.hoisted(() => ({ setRules: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ setFlightRulesAction: setRules }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { FlightRules } from "./flight-rules";

beforeEach(() => {
  setRules.mockReset();
  refresh.mockReset();
});

describe("FlightRules (the client, 18 Nov)", () => {
  // "for fuel planning etc. the IFR flight needs to be selectable for any
  // flight by the pilot. I'm not seeing a way for the pilot to select that
  // in the preflight"
  it("lets the pilot choose IFR before release, and draws the page again", async () => {
    setRules.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FlightRules flightId="f-1" isIfr={false} status="scheduled" />);
    expect(screen.getByRole("radio", { name: "VFR" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Flying IFR\? Choose it here/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "IFR" }));
    expect(setRules).toHaveBeenCalledWith("f-1", true);
    expect(refresh).toHaveBeenCalled();
  });

  it("says what IFR means for the plan, and choosing it again does nothing", async () => {
    const user = userEvent.setup();
    render(<FlightRules flightId="f-1" isIfr status="scheduled" />);
    expect(screen.getByText(/plan fuel to your alternate/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "IFR" }));
    expect(setRules).not.toHaveBeenCalled();
  });

  it("keeps the released rules, and says who changes them", () => {
    render(<FlightRules flightId="f-1" isIfr={false} status="released" />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Released VFR. Dispatch pulls the release back to change it.")).toBeInTheDocument();
  });

  it("shows the refusal", async () => {
    setRules.mockResolvedValue({ ok: false, error: "Only the flight's own pilots and dispatch choose its rules." });
    const user = userEvent.setup();
    render(<FlightRules flightId="f-1" isIfr={false} status="scheduled" />);
    await user.click(screen.getByRole("radio", { name: "IFR" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the flight's own pilots and dispatch");
    expect(refresh).not.toHaveBeenCalled();
  });
});
