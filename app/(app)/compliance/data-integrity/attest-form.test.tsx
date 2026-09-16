import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import type { AttestResult } from "./actions";

import { AttestForm } from "./attest-form";

/**
 * Signing the review.
 *
 * Three things worth pinning, all of them about not letting the
 * control overstate what it does: a note is required because the
 * record is the operator's evidence the review happened; the copy says
 * signing does not clear the findings; and a stale signature surfaces
 * as something to reload rather than as a failure.
 */

beforeEach(() => refresh.mockReset());

const ok: AttestResult = { status: "ok" };

function form(
  over: {
    contradictions?: number;
    omissions?: number;
    canSign?: boolean;
    attestAction?: (h: string, n: string) => Promise<AttestResult>;
  } = {},
) {
  const action = over.attestAction ?? vi.fn(async () => ok);
  render(
    <AttestForm
      findingsHash="abc123"
      contradictions={over.contradictions ?? 1}
      omissions={over.omissions ?? 9}
      canSign={over.canSign ?? true}
      attestAction={action}
    />,
  );
  return action;
}

describe("who can sign", () => {
  it("offers no control to a reader who cannot", () => {
    // Absent rather than present-and-403: a chief pilot reading what
    // needs correcting should not be handed a button that refuses.
    form({ canSign: false });
    expect(
      screen.queryByRole("button", { name: /Record this review/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Director of Operations/),
    ).toBeInTheDocument();
  });
});

describe("the note", () => {
  it("is required before the button works", async () => {
    form();
    expect(
      screen.getByRole("button", { name: /Record this review/ }),
    ).toBeDisabled();
  });

  it("says why on hover", () => {
    form();
    expect(
      screen.getByRole("button", { name: /Record this review/ }),
    ).toHaveAttribute("title", "Describe the review before signing it");
  });

  it("is not satisfied by whitespace", async () => {
    // The service refuses a note under ten characters. Trimming here
    // too keeps a spacebar from producing a valid-looking signature.
    form();
    await userEvent.type(
      screen.getByLabelText(/What you reviewed/),
      "          ",
    );
    expect(
      screen.getByRole("button", { name: /Record this review/ }),
    ).toBeDisabled();
  });

  it("enables the button once there is something to read", async () => {
    form();
    await userEvent.type(
      screen.getByLabelText(/What you reviewed/),
      "Reviewed the window; corrections raised.",
    );
    expect(
      screen.getByRole("button", { name: /Record this review/ }),
    ).toBeEnabled();
  });
});

describe("what signing claims", () => {
  it("says it does not clear the findings", () => {
    // The one thing somebody might reasonably assume it does.
    form({ contradictions: 1, omissions: 9 });
    expect(
      screen.getByText(/10 outstanding findings\. It does not\s+clear them/),
    ).toBeInTheDocument();
  });

  it("says nothing about clearing when there is nothing outstanding", () => {
    form({ contradictions: 0, omissions: 0 });
    expect(screen.queryByText(/does not/)).not.toBeInTheDocument();
  });

  it("counts a single finding in the singular", () => {
    form({ contradictions: 1, omissions: 0 });
    expect(
      screen.getByText(/1 outstanding finding\./),
    ).toBeInTheDocument();
  });
});

describe("submitting", () => {
  it("sends the hash it was given", async () => {
    const action = vi.fn(async () => ok);
    form({ attestAction: action });
    await userEvent.type(
      screen.getByLabelText(/What you reviewed/),
      "Reviewed and referred out.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Record this review/ }),
    );
    expect(action).toHaveBeenCalledWith(
      "abc123",
      "Reviewed and referred out.",
    );
  });

  it("offers a reload when the findings moved, rather than an error", async () => {
    // A stale signature is not a malformed request — it is a correct
    // one against figures that changed while the page was open.
    const action = vi.fn(
      async (): Promise<AttestResult> => ({
        status: "stale",
        message: "The findings changed while this page was open.",
      }),
    );
    form({ attestAction: action });
    await userEvent.type(
      screen.getByLabelText(/What you reviewed/),
      "Reviewed the earlier figures.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Record this review/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "findings changed",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reload the audit" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("clears the note and refreshes once recorded", async () => {
    form();
    const note = screen.getByLabelText(/What you reviewed/);
    await userEvent.type(note, "Monthly review complete.");
    await userEvent.click(
      screen.getByRole("button", { name: /Record this review/ }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Review recorded",
    );
    expect(note).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a refusal", async () => {
    const action = vi.fn(
      async (): Promise<AttestResult> => ({
        status: "error",
        message: "Only the Director of Operations can sign this review.",
      }),
    );
    form({ attestAction: action });
    await userEvent.type(
      screen.getByLabelText(/What you reviewed/),
      "Attempting to sign.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Record this review/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the Director of Operations",
    );
  });
});
