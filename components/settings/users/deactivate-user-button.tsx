"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  deactivateUserAction,
  type UsersActionState,
} from "@/app/(app)/settings/users/actions";

export function DeactivateUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<UsersActionState, FormData>(
    deactivateUserAction,
    { status: "idle" },
  );

  return (
    <form
      action={(formData: FormData) => {
        if (
          !window.confirm(
            `Deactivate ${email}? Their account will be unable to sign in. You can reactivate from the Edit dialog later.`,
          )
        )
          return;
        action(formData);
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      {state.status === "api-error" && (
        <p role="alert" className="mr-2 text-[0.65rem] text-status-red">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-red/40 bg-status-red/10 px-2.5 py-1 text-[0.7rem] font-semibold text-status-red hover:bg-status-red/20 disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        Deactivate
      </button>
    </form>
  );
}
