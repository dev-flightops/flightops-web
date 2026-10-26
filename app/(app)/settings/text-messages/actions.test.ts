import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    updateTextAccount: vi.fn(),
    testTextAccount: vi.fn(),
    disconnectTextAccount: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/open-seats", () => ({
  updateTextAccount: api.updateTextAccount,
  testTextAccount: api.testTextAccount,
  disconnectTextAccount: api.disconnectTextAccount,
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import type { TextAccount } from "@/lib/api/open-seats";

import { disconnectTextAccountAction, saveTextAccountAction } from "./actions";

const SID = `AC${"0123456789abcdef".repeat(2)}`;

function account(over: Partial<TextAccount> = {}): TextAccount {
  return {
    provider: "twilio",
    account_sid: SID,
    has_token: true,
    from_number: "+19075550199",
    enabled: true,
    ready: true,
    account_name: null,
    checked_at: null,
    last_error: null,
    updated_at: "2026-10-26T19:00:00Z",
    ...over,
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the text-message account (#120)", () => {
  it("saves it, sending the token only when one is typed, and checks new credentials at once", async () => {
    api.updateTextAccount.mockResolvedValue(account());
    api.testTextAccount.mockResolvedValue(account({ account_name: "Peregrine Air", checked_at: "2026-10-26T19:00:01Z" }));
    const out = await saveTextAccountAction(
      form({ account_sid: ` ${SID} `, auth_token: " secret ", from_number: "(907) 555-0199", enabled: "on" }),
    );
    expect(api.updateTextAccount).toHaveBeenCalledWith({
      account_sid: SID,
      auth_token: "secret",
      from_number: "(907) 555-0199",
      enabled: true,
    });
    expect(api.testTextAccount).toHaveBeenCalled();
    expect(out).toMatchObject({ status: "ok", message: "Saved. Texts go out.", account: { account_name: "Peregrine Air" } });
    expect(api.revalidatePath).toHaveBeenCalledWith("/settings/text-messages");

    api.updateTextAccount.mockResolvedValue(account({ checked_at: "2026-10-26T19:00:01Z", enabled: false, ready: false }));
    await saveTextAccountAction(form({ account_sid: SID, auth_token: "", from_number: "+19075550199" }));
    expect(api.updateTextAccount).toHaveBeenLastCalledWith({ account_sid: SID, from_number: "+19075550199", enabled: false });
    expect(api.testTextAccount).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["account_sid_not_twilio", 422, "A Twilio Account SID starts AC and has 32 letters and digits after it."],
    ["from_number_not_usable", 422, "Enter the number texts come from with its area code, like (907) 555-0199."],
    ["text_account_incomplete", 409, "Texts go out once the SID, auth token and number are all saved."],
    ["forbidden", 403, "Only the Director of Operations or an Exec Admin can change the text-message account."],
  ])("says what %s means", async (detail, status, error) => {
    api.updateTextAccount.mockRejectedValue(new api.TestApiError(status, "/x", JSON.stringify({ detail })));
    expect(await saveTextAccountAction(form({ account_sid: "x" }))).toEqual({ status: "error", error });
  });

  it("disconnects, keeping the texts", async () => {
    api.disconnectTextAccount.mockResolvedValue(account({ has_token: false, enabled: false, ready: false }));
    expect(await disconnectTextAccountAction()).toMatchObject({
      status: "ok",
      message: "Disconnected. Texts are kept as not sent.",
    });
  });
});
