"use client";

import { X } from "lucide-react";
import { useId, useState, useTransition } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { LoadTeamMemberResponse, LoadTeamResponse } from "@/lib/api/types";

import { addMemberAction, listMembersAction, removeMemberAction } from "./actions";
import { personLabel, type PersonOption } from "./team-dialog";

function joined(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A team's members — legacy's slide-out Members panel: lead first, then
 * alphabetical, each with their role and join date; remove with a
 * confirm; add from the staff list.
 *
 * Adding needs the staff directory. If it can't be loaded the panel
 * still lists and removes members, and says why it can't add.
 */
export function MembersSheet({
  team,
  people,
}: {
  team: LoadTeamResponse;
  people: PersonOption[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<LoadTeamMemberResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [pending, startTransition] = useTransition();
  const uid = useId();

  const leadId = team.team_lead?.id ?? null;
  const rolesById = new Map((people ?? []).map((p) => [p.id, p.roles]));

  async function reload() {
    const result = await listMembersAction(team.id);
    if (result.ok) setMembers(result.members);
    else setError(result.error);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setMembers(null);
    setError(null);
    setPick("");
    startTransition(reload);
  }

  function add() {
    if (!pick) return;
    setError(null);
    startTransition(async () => {
      const result = await addMemberAction(team.id, pick);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPick("");
      await reload();
    });
  }

  function remove(member: LoadTeamMemberResponse) {
    if (!window.confirm(`Remove ${member.user.full_name} from ${team.team_name}?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(team.id, member.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload();
    });
  }

  const sorted = [...(members ?? [])].sort(
    (a, b) =>
      Number(b.user.id === leadId) - Number(a.user.id === leadId) ||
      a.user.full_name.localeCompare(b.user.full_name),
  );
  const onTeam = new Set(sorted.map((m) => m.user.id));
  const addable = (people ?? []).filter((p) => !onTeam.has(p.id));

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Members of ${team.team_name}`}
        className="rounded border border-border bg-transparent px-2.5 py-1 text-[0.65rem] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        Members
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-sm">
          <div className="border-b border-border px-5 py-4 pr-12">
            <SheetTitle className="text-base">{team.team_name} — Members</SheetTitle>
            <SheetDescription className="mt-1 text-xs">
              {team.base_icao} · the people a dispatcher is assigning when
              they pick this team.
            </SheetDescription>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {error && (
              <p
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {error}
              </p>
            )}
            {members === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size="xs" />
                Loading members…
              </p>
            ) : sorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No members yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sorted.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">{m.user.full_name}</span>
                        {m.user.id === leadId && (
                          <span className="rounded border border-status-green/30 bg-status-green/10 px-1.5 py-px text-[0.55rem] font-bold uppercase tracking-[0.04em] text-status-green">
                            Lead
                          </span>
                        )}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        {[rolesById.get(m.user.id), `Joined ${joined(m.joined_date)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      disabled={pending}
                      aria-label={`Remove ${m.user.full_name}`}
                      className="shrink-0 rounded-md border border-border p-1 text-muted-foreground transition-colors hover:border-status-red/40 hover:text-status-red disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-5 py-4">
            {people ? (
              <div className="flex gap-2">
                <label htmlFor={`${uid}-add`} className="sr-only">
                  Employee to add
                </label>
                <select
                  id={`${uid}-add`}
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  disabled={pending || members === null}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">— Select Employee —</option>
                  {addable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={add}
                  disabled={pending || !pick}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
                >
                  {pending && <Spinner size="xs" />}+ Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                The staff list couldn&rsquo;t be loaded, so members can&rsquo;t be added right now.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
