import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getTextAccount, type TextAccount } from "@/lib/api/open-seats";
import { INTEGRATION_ADMINS, hasAnyRole } from "@/lib/roles";

import { TextMessageSettings } from "./text-message-settings";

/**
 * /settings/text-messages: the company's text-message account (#120).
 *
 * When a no-show opens a seat, the passengers waiting for it with a number
 * on the manifest are texted from this account: the company's own Twilio
 * account, so the texts come from its number and are billed to it. The
 * token sends texts in the company's name, so only the Director of
 * Operations or an Exec Admin (INTEGRATION_ADMINS) sees or changes it.
 */

export const dynamic = "force-dynamic";

export default async function TextMessagesSettingsPage() {
  const session = await auth();
  const canChange = hasAnyRole(session?.roles ?? [], INTEGRATION_ADMINS);
  let account: TextAccount | null = null;
  let loadError: string | null = null;
  if (canChange) {
    try {
      account = await getTextAccount();
    } catch (err) {
      loadError =
        err instanceof ApiError && err.status === 401
          ? "Your session expired. Sign in again."
          : "The text-message account couldn't be loaded. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Text Messages</span>
      </nav>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Text Messages</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          When a passenger doesn&rsquo;t show, the standby and waitlisted passengers waiting for that seat
          are texted from the company&rsquo;s own Twilio account. Those without a number are listed on the
          gate page for the team to call.
        </p>
      </header>
      {!canChange ? (
        <p className="notice notice-gray text-muted-foreground">
          The Director of Operations or an Exec Admin sets up the text-message account.
        </p>
      ) : loadError || !account ? (
        <p role="alert" className="notice notice-red">
          {loadError ?? "The text-message account couldn't be loaded."}
        </p>
      ) : (
        <TextMessageSettings account={account} />
      )}
    </div>
  );
}
