import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOffAction, inspectAction, rejectAction, deferAction, refresh } = vi.hoisted(() => ({
  signOffAction: vi.fn(),
  inspectAction: vi.fn(),
  rejectAction: vi.fn(),
  deferAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./actions", () => ({ signOffAction, inspectAction, rejectAction, deferAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DeferForm, InspectForm, RejectForm, SignOffForm } from "./rts-forms";

beforeEach(() => {
  for (const fn of [signOffAction, inspectAction, rejectAction, deferAction]) {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  }
  refresh.mockReset();
});

const ids = { squawkId: "s-1", aircraftId: "ac-1" };

async function fillSignOff(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Work Performed/), "Replaced the generator.");
  await user.type(screen.getByLabelText(/FAA Certificate #/), "1234567");
  await user.selectOptions(screen.getByLabelText(/Certificate Type/), "ap");
  await user.click(screen.getByLabelText(/I certify/));
}

describe("the AMT's sign-off (#172)", () => {
  it("signs with the viewer's name to start from", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SignOffForm {...ids} name="Mo Mechanic" onDone={onDone} />);
    expect(screen.getByLabelText(/AMT Name/)).toHaveValue("Mo Mechanic");
    await fillSignOff(user);
    await user.click(screen.getByRole("button", { name: "Sign Off Airworthy" }));
    expect(signOffAction).toHaveBeenCalledWith("s-1", "ac-1", {
      work_notes: "Replaced the generator.",
      amt_name: "Mo Mechanic",
      cert_number: "1234567",
      cert_type: "ap",
      airworthy: true,
      is_rii: false,
    });
    expect(onDone).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("makes clear an RII doesn't return it to service", async () => {
    const user = userEvent.setup();
    render(<SignOffForm {...ids} name="Mo" />);
    expect(screen.getByLabelText(/I certify/).parentElement).toHaveTextContent("and returned to service");
    await user.click(screen.getByLabelText(/Required Inspection Item/));
    expect(screen.getByLabelText(/I certify/).parentElement).not.toHaveTextContent("returned to service");
    await fillSignOff(user);
    await user.click(screen.getByRole("button", { name: "Sign and Send to Inspector" }));
    expect(signOffAction.mock.calls[0][2].is_rii).toBe(true);
  });

  it("won't let an RII be unflagged", () => {
    render(<SignOffForm {...ids} name="Mo" rii />);
    const box = screen.getByLabelText(/Required Inspection Item/);
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  it("says what the server refused, and stays open", async () => {
    signOffAction.mockResolvedValue({ ok: false, message: "This squawk is already resolved." });
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SignOffForm {...ids} name="Mo" onDone={onDone} />);
    await fillSignOff(user);
    await user.click(screen.getByRole("button", { name: "Sign Off Airworthy" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already resolved");
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("the inspector's sign-off (#172)", () => {
  it("signs with the name, certificate and confirmation", async () => {
    const user = userEvent.setup();
    render(<InspectForm {...ids} name="Ines" />);
    await user.type(screen.getByLabelText(/FAA Certificate Number/), "7654321");
    await user.type(screen.getByLabelText("Inspection Notes"), "Torque checked.");
    await user.click(screen.getByLabelText(/I confirm/));
    await user.click(screen.getByRole("button", { name: "Complete RII Signoff" }));
    expect(inspectAction).toHaveBeenCalledWith("s-1", "ac-1", {
      inspector_name: "Ines",
      cert_number: "7654321",
      notes: "Torque checked.",
      confirmed: true,
    });
  });

  it("carries the same-person refusal back", async () => {
    inspectAction.mockResolvedValue({ ok: false, message: "You signed this work off, so someone else has to inspect it (14 CFR 135.429)." });
    const user = userEvent.setup();
    render(<InspectForm {...ids} name="Mo" />);
    await user.type(screen.getByLabelText(/FAA Certificate Number/), "1");
    await user.click(screen.getByLabelText(/I confirm/));
    await user.click(screen.getByRole("button", { name: "Complete RII Signoff" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("someone else has to inspect it");
  });
});

describe("rejecting (#172)", () => {
  it("sends the reason", async () => {
    const user = userEvent.setup();
    render(<RejectForm {...ids} />);
    await user.type(screen.getByLabelText(/Reason for rejection/), "Safety wire missing.");
    await user.click(screen.getByRole("button", { name: /Reject/ }));
    expect(rejectAction).toHaveBeenCalledWith("s-1", "ac-1", "Safety wire missing.");
  });
});

describe("deferring (#172)", () => {
  it("offers the MMEL's categories, and defers under one", async () => {
    const user = userEvent.setup();
    render(<DeferForm {...ids} />);
    const options = Array.from(screen.getByLabelText("MEL Category").querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["Cat A (per the remarks)", "Cat B (3 days)", "Cat C (10 days)", "Cat D (120 days)"]);
    expect(screen.getByLabelText("MEL Category")).toHaveValue("C");
    await user.type(screen.getByLabelText(/ATA Chapter/), "24-30");
    await user.type(screen.getByLabelText("MEL Reference"), "MEL 24-30-1");
    await user.type(screen.getByLabelText(/Deferral Reason/), "Parts on order.");
    await user.click(screen.getByRole("button", { name: "Defer" }));
    expect(deferAction).toHaveBeenCalledWith("s-1", "ac-1", {
      defer_type: "mel",
      reason: "Parts on order.",
      mel_category: "C",
      ata_chapter: "24-30",
      reference: "MEL 24-30-1",
      due_on: "",
    });
  });

  it("needs a date for category A and a DMI, and asks a DMI for no MEL details", async () => {
    const user = userEvent.setup();
    render(<DeferForm {...ids} />);
    expect(screen.getByLabelText(/Due Date/)).not.toBeRequired();
    await user.selectOptions(screen.getByLabelText("MEL Category"), "A");
    expect(screen.getByLabelText(/Due Date/)).toBeRequired();
    await user.selectOptions(screen.getByLabelText("MEL Category"), "B");
    await user.selectOptions(screen.getByLabelText("Deferral Type"), "dmi");
    expect(screen.getByLabelText(/Due Date/)).toBeRequired();
    expect(screen.queryByLabelText("MEL Category")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ATA Chapter/)).not.toBeInTheDocument();
    expect(screen.getByText(/grounds the aircraft if the date passes/)).toBeInTheDocument();
  });
});
