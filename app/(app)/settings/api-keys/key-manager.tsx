"use client";

import { useActionState, useState } from "react";

import { Panel } from "@/components/ff/panel";
import type { ApiKeyRow } from "@/lib/api/api-keys";

import { KeyTable } from "./key-table";

import {
  issueApiKeyAction,
  revokeApiKeyAction,
  type ApiKeyActionState,
} from "./actions";

/**
 * Issue + revoke UI for Public API keys.
 *
 * The reveal-once panel is the important part. Only a SHA-256 hash is
 * stored, so the plaintext exists exactly once — in the create
 * response. There is no endpoint that can show it again, so this panel
 * has to say so plainly and make copying it the obvious next action.
 * An operator who closes it without copying has to issue a new key.
 */

const IDLE: ApiKeyActionState = { status: "idle" };

export function KeyManager({ keys }: { keys: ApiKeyRow[] }) {
  const [createState, createAction, creating] = useActionState(
    issueApiKeyAction,
    IDLE,
  );
  const [revokeState, revokeAction] = useActionState(
    revokeApiKeyAction,
    IDLE,
  );

  const fieldError = (name: string) =>
    createState.status === "field-errors"
      ? createState.errors[name]
      : undefined;

  return (
    <div className="space-y-5">
      {createState.status === "created" && (
        <NewKeyPanel plaintext={createState.plaintext} name={createState.name} />
      )}

      {(createState.status === "api-error" ||
        revokeState.status === "api-error") && (
        <p className="notice notice-red text-sm">
          {createState.status === "api-error"
            ? createState.message
            : revokeState.status === "api-error"
              ? revokeState.message
              : null}
        </p>
      )}

      <Panel title="Issue a new key">
        <form action={createAction}>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-start">
            <label className="block">
              <span className="field-label">
                Name
              </span>
              <input
                name="name"
                placeholder="Partner portal (read-only)"
                className="ff-input px-3 py-2 text-sm"
              />
              {fieldError("name") && (
                <span role="alert" className="field-error block">
                  {fieldError("name")}
                </span>
              )}
            </label>
            <label className="block">
              <span className="field-label">
                Expires (optional)
              </span>
              <input
                name="expires_at"
                type="date"
                className="ff-input px-3 py-2 text-sm"
              />
              {fieldError("expires_at") && (
                <span role="alert" className="field-error block">
                  {fieldError("expires_at")}
                </span>
              )}
            </label>
            <button
              type="submit"
              disabled={creating}
              className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 sm:mt-[1.35rem]"
            >
              {creating ? "Issuing…" : "Issue key"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Leave expiry blank for a key that only stops when revoked.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" name="scope_crew" className="mt-1" />
            <span>
              Crew and duty
              <span className="block text-xs text-muted-foreground">
                Also reads who is crewing each flight (names and emails) and each pilot&rsquo;s duty, rest
                and flight time. Only for a planning tool that needs them; it can&rsquo;t be added to a key
                later.
              </span>
            </span>
          </label>
        </form>
      </Panel>

      <KeyTable
        keys={keys}
        renderRevoke={(k) => (
          <form action={revokeAction}>
            <input type="hidden" name="key_id" value={k.id} />
            <button
              type="submit"
              className="btn-caps rounded-md border border-status-red/60 px-2.5 py-1 text-[0.68rem] text-status-red hover:border-status-red"
            >
              Revoke
            </button>
          </form>
        )}
      />
    </div>
  );
}

/** Shown once, immediately after creation. */
function NewKeyPanel({ plaintext, name }: { plaintext: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="notice notice-green">
      <p className="notice-label">
        “{name}” created — copy it now
      </p>
      <p className="mt-1 text-xs">
        This is the only time the key is shown. We store a hash of it, not
        the key itself, so it cannot be retrieved later. If you lose it,
        revoke this key and issue another.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
          {plaintext}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(plaintext).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="btn-caps rounded-md bg-status-green-fill px-3 py-2 text-white hover:brightness-95 text-[0.72rem]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

