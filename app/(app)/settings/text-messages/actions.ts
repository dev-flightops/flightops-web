"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  disconnectTextAccount,
  testTextAccount,
  updateTextAccount,
  type TextAccount,
} from "@/lib/api/open-seats";

/**
 * /settings/text-messages server actions (#120). Each returns an outcome
 * for the form to show rather than throwing to the error page.
 */

export type TextAccountOutcome =
  | { status: "idle" }
  | { status: "ok"; account: TextAccount; message: string }
  | { status: "error"; error: string };

const PATH = "/settings/text-messages";

function failure(err: unknown): TextAccountOutcome {
  if (err instanceof ApiError) {
    if (err.status === 401) return { status: "error", error: "Your session expired. Sign in again, then retry." };
    if (err.status === 403) {
      return {
        status: "error",
        error: "Only the Director of Operations or an Exec Admin can change the text-message account.",
      };
    }
    if (err.message.includes("account_sid_not_twilio")) {
      return { status: "error", error: "A Twilio Account SID starts AC and has 32 letters and digits after it." };
    }
    if (err.message.includes("from_number_not_usable")) {
      return { status: "error", error: "Enter the number texts come from with its area code, like (907) 555-0199." };
    }
    if (err.message.includes("text_account_incomplete")) {
      return { status: "error", error: "Texts go out once the SID, auth token and number are all saved." };
    }
  }
  return { status: "error", error: "That didn't go through. Try again in a moment." };
}

/** Save the account; with new credentials, check them with Twilio at once
 *  so the page can say whose account it is. */
export async function saveTextAccountAction(formData: FormData): Promise<TextAccountOutcome> {
  const sid = String(formData.get("account_sid") ?? "").trim();
  const token = String(formData.get("auth_token") ?? "").trim();
  const number = String(formData.get("from_number") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  try {
    let account = await updateTextAccount({
      account_sid: sid,
      ...(token ? { auth_token: token } : {}),
      from_number: number,
      enabled,
    });
    if (account.account_sid && account.has_token && !account.checked_at) {
      account = await testTextAccount();
    }
    revalidatePath(PATH);
    return { status: "ok", account, message: account.ready ? "Saved. Texts go out." : "Saved." };
  } catch (err) {
    return failure(err);
  }
}

export async function testTextAccountAction(): Promise<TextAccountOutcome> {
  try {
    const account = await testTextAccount();
    revalidatePath(PATH);
    return {
      status: "ok",
      account,
      message: account.last_error ? "Twilio didn't take it." : "Twilio knows this account.",
    };
  } catch (err) {
    return failure(err);
  }
}

export async function disconnectTextAccountAction(): Promise<TextAccountOutcome> {
  try {
    const account = await disconnectTextAccount();
    revalidatePath(PATH);
    return { status: "ok", account, message: "Disconnected. Texts are kept as not sent." };
  } catch (err) {
    return failure(err);
  }
}
