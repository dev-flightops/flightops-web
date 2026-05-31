"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { ProviderSummary } from "@/lib/api/types";

/**
 * Login page — pixel-match for `dispatch-platform-main/templates/login.html`:
 *
 *   - 380px max-width column, fully centered on the viewport
 *   - Brand block above the card ("Peregrine Flight Ops" + subtitle)
 *   - Card: 12px radius, panel bg, 2rem padding
 *   - Error banner (dark red panel with icon) at the top of the card when set
 *   - SSO buttons rendered ABOVE the form with a "or use password" divider
 *     (legacy puts the password form after SSO, not below)
 *   - Form labels: tiny uppercase tracked-wide
 *   - Form inputs: 7px radius, deeper-than-card bg, iOS-blue focus glow
 *   - Submit button: full-width iOS blue, semibold
 *   - "Authorized users only" helper + back link below the card
 *
 * Colors are literal hex from the legacy stylesheet to ensure exact match.
 */

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginInner({ providers }: { providers: ProviderSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/home";
  const ssoError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    ssoError ? "Sign-in failed — your account may not be provisioned." : null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!result || result.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(from);
    router.refresh();
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Brand block */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-xl font-bold text-foreground">
            Peregrine Flight Ops
          </h1>
          <p className="text-sm text-[#8896a7]">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#1e2d42] bg-[#0f1520] p-8">
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-[#5c1212] bg-[#1a0808] px-4 py-3 text-sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#f87171"
                className="flex-shrink-0"
                aria-hidden
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span className="text-[#f87171]" role="alert">
                {error}
              </span>
            </div>
          )}

          {providers.length > 0 && (
            <>
              <div className="mb-4 space-y-2">
                {providers.map((p) => (
                  <SsoButton
                    key={p.id}
                    provider={p}
                    callbackUrl={from}
                    disabled={isSubmitting}
                  />
                ))}
              </div>

              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#1e2d42]" />
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[#4a5568]">
                  or use password
                </span>
                <div className="h-px flex-1 bg-[#1e2d42]" />
              </div>
            </>
          )}

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8896a7]"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="ff-login-input"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-[#f87171]" role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8896a7]"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="ff-login-input"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-[#f87171]" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full cursor-pointer rounded-md border-none bg-[#0a84ff] px-4 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#338dff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[#4a5568]">
          Authorized users only &mdash; contact your administrator for access.
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/home" className="text-[#8896a7] hover:underline">
            &larr; Back to home
          </Link>
        </p>
      </div>

      {/* Legacy `.ff-input` styling — scoped to login so we don't override
          the global Input primitive used elsewhere. */}
      <style>{`
        .ff-login-input {
          width: 100%;
          background: #0a0e14;
          color: #e8edf2;
          border: 1px solid #1e2d42;
          border-radius: 7px;
          padding: 0.6rem 0.85rem;
          font-size: 0.9rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .ff-login-input:focus {
          border-color: #0a84ff;
          box-shadow: 0 0 0 3px rgba(10,132,255,.15);
        }
        .ff-login-input::placeholder { color: #3a4a5c; }
      `}</style>
    </div>
  );
}

/**
 * Brand-coloured SSO button per provider, matching the legacy login.html
 * styling (Microsoft / Google / Okta each get their own pill colors).
 */
function SsoButton({
  provider,
  callbackUrl,
  disabled,
}: {
  provider: ProviderSummary;
  callbackUrl: string;
  disabled?: boolean;
}) {
  const style = SSO_STYLES[provider.id] ?? SSO_STYLES.default;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => signIn(provider.id, { callbackUrl })}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[0.9rem] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      style={style}
    >
      Sign in with {provider.label}
    </button>
  );
}

const SSO_STYLES: Record<string, React.CSSProperties> = {
  "microsoft-entra-id": { background: "#2563eb", color: "#fff" },
  google: {
    background: "#fff",
    color: "#333",
    border: "1px solid #ddd",
  },
  okta: { background: "#007dc1", color: "#fff" },
  default: { background: "#6366f1", color: "#fff" },
};

export function LoginForm({ providers }: { providers: ProviderSummary[] }) {
  return (
    <Suspense fallback={null}>
      <LoginInner providers={providers} />
    </Suspense>
  );
}
