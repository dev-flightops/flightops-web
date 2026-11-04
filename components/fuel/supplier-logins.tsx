"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addSupplierLoginAction,
  setSupplierLoginActiveAction,
  setSupplierLoginPasswordAction,
  type SupplierLoginResult,
} from "@/app/(app)/fuel/suppliers/actions";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { SupplierLogin } from "@/lib/api/auth";
import { DEFAULT_TIME_ZONE, localDateTime } from "@/lib/format/local-time";

/**
 * A supplier's portal logins (#134). Nothing could create one, so no
 * supplier reached the portal and every fuel order read "call them". The
 * rep signs in at /fuel-supplier/login and sees, confirms and records the
 * fueling of this company's orders for their supplier.
 */
export function SupplierLogins({
  supplierId,
  supplierName,
  logins,
}: {
  supplierId: string;
  supplierName: string;
  /** null when they couldn't be read. */
  logins: SupplierLogin[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (action: () => Promise<SupplierLoginResult>, after?: () => void) => {
    setNotice(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        after?.();
        router.refresh();
        if (result.message) setNotice({ ok: true, text: result.message });
      } else {
        setNotice({ ok: false, text: result.error ?? "Something went wrong." });
      }
    });
  };

  return (
    <section className="mt-4 border-t border-border pt-3" aria-label={`Portal logins for ${supplierName}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="eyebrow">Portal logins</h3>
        {!adding ? (
          <button type="button" className={buttonOutline} onClick={() => setAdding(true)}>
            + Add login
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The supplier signs in at /fuel-supplier/login to see your orders, confirm them and record the fueling.
      </p>

      {logins === null ? (
        <p className="mt-2 text-xs text-muted-foreground">Couldn&apos;t load the logins.</p>
      ) : logins.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No login yet: fuel orders tell dispatch to call them.
        </p>
      ) : (
        // Scrolls on its own at phone width: the buttons column pushed the
        // page 49 px sideways at 390.
        <div className="mt-2 overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logins.map((login) => (
                <tr key={login.id}>
                  <td>{login.full_name}</td>
                  <td className="font-mono text-xs">{login.email}</td>
                  <td className="text-xs">
                    {login.last_login_at ? localDateTime(login.last_login_at, DEFAULT_TIME_ZONE) : "Never"}
                  </td>
                  <td>{login.is_active ? "Active" : <span className="text-muted-foreground">Off</span>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={buttonOutline}
                        disabled={pending}
                        onClick={() => run(() => setSupplierLoginActiveAction(supplierId, login.id, !login.is_active))}
                      >
                        {login.is_active ? "Switch off" : "Switch on"}
                      </button>
                      {login.serves_others ? null : (
                        <button type="button" className={buttonOutline} disabled={pending} onClick={() => setPasswordFor(login.id)}>
                          New password
                        </button>
                      )}
                    </div>
                    {login.serves_others ? (
                      <p className="mt-1 text-right text-xs text-muted-foreground">
                        Signs in for another operator too, so the password is theirs.
                      </p>
                    ) : null}
                    {passwordFor === login.id ? (
                      <form
                        method="post"
                        className="mt-2 flex flex-wrap justify-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const password = String(new FormData(e.currentTarget).get("password") ?? "");
                          run(() => setSupplierLoginPasswordAction(supplierId, login.id, password), () => setPasswordFor(null));
                        }}
                      >
                        <label className="sr-only" htmlFor={`password-${login.id}`}>
                          New password for {login.full_name}
                        </label>
                        <input
                          id={`password-${login.id}`}
                          name="password"
                          type="password"
                          minLength={8}
                          required
                          autoComplete="new-password"
                          placeholder="New password (8+ characters)"
                          className="ff-input h-8 w-56 py-0 text-xs"
                        />
                        <button type="submit" className={buttonSolid} disabled={pending}>
                          {pending ? "Saving…" : "Set"}
                        </button>
                        <button type="button" className={buttonOutline} onClick={() => setPasswordFor(null)}>
                          Cancel
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <form
          method="post"
          className="mt-3 grid gap-3 sm:grid-cols-3"
          aria-label={`Add a login for ${supplierName}`}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const value = (key: string) => String(form.get(key) ?? "");
            run(
              () =>
                addSupplierLoginAction(supplierId, {
                  full_name: value("full_name"),
                  email: value("email"),
                  password: value("password"),
                }),
              () => setAdding(false),
            );
          }}
        >
          <label>
            <span className="field-label">Name</span>
            <input name="full_name" required maxLength={200} className="ff-input" />
          </label>
          <label>
            <span className="field-label">Email</span>
            <input name="email" type="email" required maxLength={254} className="ff-input" />
          </label>
          <label>
            <span className="field-label">Password</span>
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="8+ characters"
              className="ff-input"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Not needed if they already sign in for another operator.
            </span>
          </label>
          <div className="flex gap-2 sm:col-span-3 sm:justify-end">
            <button type="button" className={buttonOutline} onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? "Adding…" : "Add login"}
            </button>
          </div>
        </form>
      ) : null}

      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "mt-2 text-sm text-foreground" : "field-error mt-2"}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
