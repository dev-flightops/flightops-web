"use client";

import { useActionState, useRef } from "react";

import type { RampPhotoType } from "@/lib/api/types";

import {
  uploadRampPhotoAction,
  type UploadState,
} from "./actions";

const PHOTO_TYPES: readonly {
  value: RampPhotoType;
  label: string;
}[] = [
  { value: "secured_load", label: "Secured Load" },
  { value: "hazmat_placard", label: "Hazmat Placard" },
  { value: "damage_documentation", label: "Damage Documentation" },
  { value: "general", label: "General" },
];

const INITIAL: UploadState = { status: "idle" };

/** Multipart photo upload form. Server action posts to
 *  /ground/flights/{id}/photos and then revalidates this page so
 *  the gallery + required-photo checklist re-render with the new
 *  photo included. */
export function UploadRampPhotoForm({ flightId }: { flightId: string }) {
  const action = uploadRampPhotoAction.bind(null, flightId);
  const [state, dispatch, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful upload, clear the file input so the next
  // photo doesn't accidentally re-post the previous file.
  if (state.status === "ok" && formRef.current) {
    formRef.current.reset();
  }

  return (
    <form
      ref={formRef}
      action={dispatch}
      className="space-y-3"
      encType="multipart/form-data"
    >
      <label className="block">
        <span className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Photo Type
        </span>
        <select
          name="photo_type"
          defaultValue="secured_load"
          disabled={pending}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30 disabled:opacity-60"
        >
          {PHOTO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <input
            type="file"
            name="photo"
            accept="image/*"
            // capture="environment" so mobile browsers open the rear
            // camera directly instead of the photo picker — matches
            // legacy ramper flow.
            capture="environment"
            required
            disabled={pending}
            className="w-full rounded-xl border border-border bg-background px-2 py-2 text-xs disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-label="Upload photo"
          className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl border-2 border-status-blue/30 bg-status-blue/15 text-status-blue transition-colors hover:bg-status-blue/25 active:bg-status-blue/35 disabled:opacity-50"
        >
          {pending ? (
            <span className="text-[0.55rem] font-bold uppercase">Sending</span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            </svg>
          )}
        </button>
      </div>

      <input
        type="text"
        name="notes"
        placeholder="Notes (optional)"
        disabled={pending}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30 disabled:opacity-60"
      />

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green">
          Photo uploaded.
        </p>
      )}
    </form>
  );
}
