"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  deleteSsoProviderAction,
  type SsoActionState,
} from "@/app/(app)/settings/sso/actions";

/**
 * Hard-delete button. Hard-delete (not soft) because the row IS the
 * credentials — soft-deleting a stored client_secret leaves an
 * actionable secret in the DB long after the admin decided to
 * disconnect, which is the wrong default.
 */
export function DisconnectProviderButton({
  providerId,
  providerLabel,
}: {
  providerId: string;
  providerLabel: string;
}) {
  const [state, action, pending] = useActionState<SsoActionState, FormData>(
    deleteSsoProviderAction,
    { status: "idle" },
  );

  return (
    <form
      action={(formData: FormData) => {
        if (
          !window.confirm(
            `Disconnect ${providerLabel}? The stored client_id + secret will be deleted. Your users will lose the ${providerLabel} sign-in button until you reconnect.`,
          )
        )
          return;
        action(formData);
      }}
    >
      <input type="hidden" name="provider_id" value={providerId} />
      {state.status === "api-error" && (
        <p role="alert" className="mr-2 text-[0.65rem] text-status-red">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-1.5 text-xs font-semibold text-status-red hover:bg-status-red/20 disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        Disconnect
      </button>
    </form>
  );
}
