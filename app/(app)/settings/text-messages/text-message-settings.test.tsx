import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  saveTextAccountAction: vi.fn(),
  testTextAccountAction: vi.fn(),
  disconnectTextAccountAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import type { TextAccount } from "@/lib/api/open-seats";

import { TextMessageSettings } from "./text-message-settings";

function account(over: Partial<TextAccount> = {}): TextAccount {
  return {
    provider: "twilio",
    account_sid: null,
    has_token: false,
    from_number: null,
    enabled: false,
    ready: false,
    account_name: null,
    checked_at: null,
    last_error: null,
    updated_at: null,
    ...over,
  };
}

describe("the text-message account form (#120)", () => {
  it("says texts are kept until there is an account, and asks for one", () => {
    render(<TextMessageSettings account={account()} />);
    expect(screen.getByText("Not sending")).toBeTruthy();
    expect(screen.getByText(/texts are kept as not sent, and the gate page lists who to call/)).toBeTruthy();
    const form = screen.getByRole("form", { name: "Text-message account" });
    expect((within(form).getByLabelText("Auth token") as HTMLInputElement).placeholder).toBe("From the Twilio console");
    expect(within(form).queryByRole("button", { name: "Test" })).toBeNull();
    expect(within(form).getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("shows a ready account without its token", () => {
    render(
      <TextMessageSettings
        account={account({
          account_sid: "AC0123",
          has_token: true,
          from_number: "+19075550199",
          enabled: true,
          ready: true,
          account_name: "Peregrine Air",
          updated_at: "2026-10-26T19:00:00Z",
        })}
      />,
    );
    expect(screen.getByText("Texts go out")).toBeTruthy();
    expect(screen.getByText("From +19075550199, on Twilio account Peregrine Air.")).toBeTruthy();
    const form = screen.getByRole("form", { name: "Text-message account" });
    const token = within(form).getByLabelText("Auth token") as HTMLInputElement;
    expect(token.value).toBe("");
    expect(token.placeholder).toBe("Saved; enter a new one to replace it");
    expect((within(form).getByLabelText(/Text passengers waiting/) as HTMLInputElement).checked).toBe(true);
    expect(within(form).getByRole("button", { name: "Test" })).toBeTruthy();
    expect(within(form).getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("keeps what was typed when a save is refused, and shows what was saved when it isn't", async () => {
    render(<TextMessageSettings account={account()} />);
    const form = screen.getByRole("form", { name: "Text-message account" });
    const sid = within(form).getByLabelText("Twilio Account SID") as HTMLInputElement;
    const token = within(form).getByLabelText("Auth token") as HTMLInputElement;
    const from = within(form).getByLabelText("Texts come from") as HTMLInputElement;
    fireEvent.change(sid, { target: { value: "AC0123" } });
    fireEvent.change(token, { target: { value: "secret" } });
    fireEvent.change(from, { target: { value: "907 555 0199" } });

    actions.saveTextAccountAction.mockResolvedValueOnce({
      status: "error",
      error: "Texts go out once the SID, auth token and number are all saved.",
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("SID, auth token and number"));
    expect([sid.value, token.value, from.value]).toEqual(["AC0123", "secret", "907 555 0199"]);

    actions.saveTextAccountAction.mockResolvedValueOnce({
      status: "ok",
      message: "Saved.",
      account: account({ account_sid: "AC0123", has_token: true, from_number: "+19075550199", updated_at: "2026-10-26T19:05:00Z" }),
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved."));
    const saved = screen.getByRole("form", { name: "Text-message account" });
    expect((within(saved).getByLabelText("Texts come from") as HTMLInputElement).value).toBe("+19075550199");
    expect((within(saved).getByLabelText("Auth token") as HTMLInputElement).value).toBe("");
  });
});
