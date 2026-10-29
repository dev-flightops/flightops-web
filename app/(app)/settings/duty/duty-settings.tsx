"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { Panel } from "@/components/ff/panel";
import { Spinner } from "@/components/ui/spinner";
import { ROLES, formatRole } from "@/lib/roles";

import { saveDutySettingsAction } from "./actions";

/**
 * Who may correct anyone's duty times (#100). A pilot always corrects
 * their own; the roles ticked here may correct anyone's, from the
 * pilot's page, and the pilot sees who did it and why.
 */
export function DutySettingsForm({
  correctionRoles,
  canEdit,
}: {
  correctionRoles: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(correctionRoles));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(role: string) {
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveDutySettingsAction(ROLES.filter((r) => picked.has(r)));
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-6">
        <Panel title="Who May Correct Anyone's Duty Times">
          <fieldset disabled={!canEdit} className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Roles that may correct anyone&apos;s duty times</legend>
            {ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={picked.has(role)} onChange={() => toggle(role)} />
                {formatRole(role)}
              </label>
            ))}
          </fieldset>
          <p className="mt-3 text-xs text-muted-foreground">
            A pilot always corrects their own. Whoever is ticked here corrects anyone&apos;s from the
            pilot&apos;s page, under Crew Currency, and the pilot sees who corrected it and why.
          </p>
        </Panel>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? <Spinner size="xs" /> : null}
              Save Duty Corrections
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            The Director of Operations or an Exec Admin can change this.
          </p>
        )}
      </form>

      {message ? (
        <Notice tone={message.ok ? "green" : "red"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}
