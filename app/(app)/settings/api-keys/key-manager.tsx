"use client";

import { useActionState, useState } from "react";

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
        <p className="rounded-md border border-status-red/40 bg-status-red/5 px-3 py-2 text-sm text-status-red">
          {createState.status === "api-error"
            ? createState.message
            : revokeState.status === "api-error"
              ? revokeState.message
              : null}
        </p>
      )}

      <form
        action={createAction}
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Issue a new key
        </h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-start">
          <label className="block">
            <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Name
            </span>
            <input
              name="name"
              placeholder="Partner portal (read-only)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
            />
            {fieldError("name") && (
              <span role="alert" className="mt-1 block text-[0.6875rem] text-status-red">
                {fieldError("name")}
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Expires (optional)
            </span>
            <input
              name="expires_at"
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
            />
            {fieldError("expires_at") && (
              <span role="alert" className="mt-1 block text-[0.6875rem] text-status-red">
                {fieldError("expires_at")}
              </span>
            )}
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 sm:mt-[1.35rem]"
          >
            {creating ? "Issuing…" : "Issue key"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Leave expiry blank for a key that only stops when revoked.
        </p>
      </form>

      <KeyTable
        keys={keys}
        renderRevoke={(k) => (
          <form action={revokeAction}>
            <input type="hidden" name="key_id" value={k.id} />
            <button
              type="submit"
              className="rounded-md border border-status-red/40 px-2.5 py-1 text-xs font-semibold text-status-red hover:bg-status-red/10"
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
    <div className="rounded-xl border border-status-green/40 bg-status-green/5 p-4">
      <p className="text-sm font-semibold text-status-green">
        “{name}” created — copy it now
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
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
          className="rounded-md bg-status-green px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

