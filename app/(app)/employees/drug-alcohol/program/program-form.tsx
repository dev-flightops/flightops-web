"use client";

import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";
import type { StaffMember } from "@/lib/api/auth";
import type { Program } from "@/lib/api/drug-alcohol";
import { ROLES, formatRole } from "@/lib/roles";

import { saveProgramAction } from "../actions";

/**
 * The program's settings, what legacy kept at the top of its pool page: the
 * DER and an alternate (who, with the Exec Admins, see the results), the
 * random rates, the roles in the pool, and what the MIS form's employer
 * section asks for.
 */
export function ProgramForm({ program, staff }: { program: Program; staff: StaffMember[] }) {
  const [values, setValues] = useState({
    der_user_id: program.der?.id ?? "",
    alternate_der_user_id: program.alternate_der?.id ?? "",
    der_phone: program.der_phone ?? "",
    drug_rate_pct: String(program.drug_rate_pct),
    alcohol_rate_pct: String(program.alcohol_rate_pct),
    safety_sensitive_roles: program.safety_sensitive_roles,
    faa_certificate_number: program.faa_certificate_number ?? "",
    plan_number: program.plan_number ?? "",
    ctpa_name: program.ctpa_name ?? "",
    ctpa_phone: program.ctpa_phone ?? "",
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
  const input = (name: keyof typeof values, label: string, props: { type?: string; hint?: string } = {}) => (
    <div>
      <label htmlFor={`program-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`program-${name}`}
        type={props.type ?? "text"}
        value={values[name] as string}
        onChange={set(name)}
        className="ff-input w-full px-3 py-2 text-sm"
      />
      {props.hint ? <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p> : null}
    </div>
  );

  return (
    <form
      method="post"
      aria-label="The program"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await saveProgramAction(values);
          setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.message });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["der_user_id", "Designated Employer Representative"],
            ["alternate_der_user_id", "Alternate DER"],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <label htmlFor={`program-${name}`} className="field-label">
              {label}
            </label>
            <select id={`program-${name}`} value={values[name]} onChange={set(name)} className="ff-input w-full px-3 py-2 text-sm">
              <option value="">None</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.roles[0] ? ` · ${formatRole(s.roles[0])}` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
        {input("der_phone", "DER Phone", { type: "tel" })}
        {input("drug_rate_pct", "Random Drug Rate (%)", { type: "number", hint: "The FAA's minimum for 2026 is 25%." })}
        {input("alcohol_rate_pct", "Random Alcohol Rate (%)", { type: "number", hint: "The FAA's minimum for 2026 is 10%." })}
      </div>
      <fieldset>
        <legend className="field-label">Roles in the Random Pool</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Everyone holding one of these is in the pool, unless left out on the Random Pool tab.
        </p>
        <div className="grid gap-1 sm:grid-cols-3">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.safety_sensitive_roles.includes(role)}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    safety_sensitive_roles: e.target.checked
                      ? [...v.safety_sensitive_roles, role]
                      : v.safety_sensitive_roles.filter((r) => r !== role),
                  }))
                }
              />
              {formatRole(role)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("faa_certificate_number", "FAA Certificate Number")}
        {input("plan_number", "Antidrug Plan / Registration Number")}
        {input("ctpa_name", "Consortium / TPA")}
        {input("ctpa_phone", "Consortium / TPA Phone", { type: "tel" })}
      </div>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-status-green" : "field-error"}>
          {message.text}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : "Save the Program"}
        </button>
      </div>
    </form>
  );
}
