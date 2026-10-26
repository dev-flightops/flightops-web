"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import type { TextAccount } from "@/lib/api/open-seats";

import {
  disconnectTextAccountAction,
  saveTextAccountAction,
  testTextAccountAction,
  type TextAccountOutcome,
} from "./actions";

/**
 * The company's Twilio account (#120): the Account SID, the auth token
 * (never shown again once saved), the number texts come from, and
 * whether texts go out at all.
 *
 * Saved through onSubmit rather than a form action: React resets a form
 * after its action, which wiped what the DO had typed whenever a save was
 * refused, and the next Save then cleared the account.
 */
export function TextMessageSettings({ account: initial }: { account: TextAccount }) {
  const [latest, setLatest] = useState<TextAccountOutcome>({ status: "idle" });
  const [account, setAccount] = useState(initial);
  const [busy, startBusy] = useTransition();

  const run = (action: () => Promise<TextAccountOutcome>) =>
    startBusy(async () => {
      const outcome = await action();
      setLatest(outcome);
      if (outcome.status === "ok") setAccount(outcome.account);
    });

  return (
    <div className="space-y-5">
      <Status account={account} />

      <form
        // Remounted with what was saved, so the box and fields match it and
        // a typed token doesn't linger in the page.
        key={account.updated_at ?? "new"}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          run(() => saveTextAccountAction(data));
        }}
        aria-label="Text-message account"
        className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2"
      >
        <label className="grid gap-1 text-xs sm:col-span-2">
          <span className="field-label">Twilio Account SID</span>
          <input
            name="account_sid"
            defaultValue={account.account_sid ?? ""}
            placeholder="AC…"
            autoComplete="off"
            spellCheck={false}
            className="ff-input font-mono text-xs"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="field-label">Auth token</span>
          <input
            name="auth_token"
            type="password"
            autoComplete="new-password"
            placeholder={account.has_token ? "Saved; enter a new one to replace it" : "From the Twilio console"}
            className="ff-input text-xs"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="field-label">Texts come from</span>
          <input
            name="from_number"
            type="tel"
            defaultValue={account.from_number ?? ""}
            placeholder="(907) 555-0199"
            className="ff-input text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-xs sm:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={account.enabled} className="accent-primary" />
          Text passengers waiting for a seat a no-show opened
        </label>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          {account.has_token ? (
            <>
              <button type="button" disabled={busy} onClick={() => run(testTextAccountAction)} className={buttonOutline}>
                Test
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(disconnectTextAccountAction)}
                className={buttonOutline}
              >
                Disconnect
              </button>
            </>
          ) : null}
          <button type="submit" disabled={busy} className={buttonSolid}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {latest.status === "error" ? <Notice tone="red">{latest.error}</Notice> : null}
      {latest.status === "ok" ? (
        <Notice tone="green" role="status">
          {latest.message}
        </Notice>
      ) : null}
    </div>
  );
}

function Status({ account }: { account: TextAccount }) {
  if (account.ready) {
    return (
      <Notice tone="green" label="Texts go out">
        {account.account_name ? `From ${account.from_number}, on Twilio account ${account.account_name}.` : `From ${account.from_number}.`}
        {account.last_error ? ` Last check: ${account.last_error}` : ""}
      </Notice>
    );
  }
  return (
    <Notice tone="gray" label="Not sending">
      {account.has_token
        ? "Switch texts on below to send them. Until then they are kept as not sent, and the gate page lists who to call."
        : "Without an account, texts are kept as not sent, and the gate page lists who to call."}
      {account.last_error ? ` Last check: ${account.last_error}` : ""}
    </Notice>
  );
}
