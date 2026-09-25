"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type {
  ProviderSummary,
  SsoResolveProvider,
} from "@/lib/api/types";

import { HomeWordmark } from "@/components/home/home-brand";
import { Button } from "@/components/ui/button";

import { resolveSsoAction } from "./actions";

/**
 * Login — the first screen of any pitch, in the home page's language.
 *
 * Was a pixel-match of legacy login.html: dark navy card, iOS-blue
 * button, its own system-font stack, and every colour a literal hex —
 * the one page with arbitrary hex in its classes (15 of them). The
 * operator asked for the app to look like one product, so this is a
 * deliberate departure from legacy, recorded here.
 *
 * Split screen: the home page's aircraft photo as an ink panel on the
 * left (hidden on phones), the form on the light ground on the right.
 * Inputs are the app's one `.ff-input`; the submit is <Button>.
 *
 * Behaviour is unchanged: debounced per-tenant SSO resolution as the
 * email is typed, zod validation, the `from` redirect, the SSO error
 * param. The provider buttons keep their brand-mandated colours.
 *
 * Removed: "← Back to home". /home requires a session, so for anyone on
 * this page it redirected straight back here — a link that looped.
 */

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginInner({ providers }: { providers: ProviderSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/home/";
  const ssoError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    ssoError ? "Sign-in failed — your account may not be provisioned." : null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // SSO providers shown to the user. Starts as the env-enabled list
  // (server-fetched, in the initial render). When the user types an
  // email that resolves to a tenant with per-tenant SSO config, this
  // gets replaced with the tenant-specific list (with display_name
  // overrides). Empty list hides the SSO panel entirely.
  const [resolvedProviders, setResolvedProviders] = useState<
    SsoResolveProvider[] | null
  >(null);
  const email = form.watch("email");

  // Debounced /sso/resolve lookup as the user types. 400 ms is long
  // enough that typing a 30-char email doesn't fan out 30 calls but
  // short enough that the button changes feel instantaneous after
  // the user pauses.
  useEffect(() => {
    if (!email || !email.includes("@")) {
      setResolvedProviders(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      resolveSsoAction(email).then((resp) => {
        if (!cancelled) setResolvedProviders(resp.providers);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [email]);

  // What buttons actually render: the resolved per-tenant list when
  // we have one, otherwise the server-rendered env-driven default.
  const visibleProviders: SsoButtonProvider[] =
    resolvedProviders !== null
      ? resolvedProviders.map((p) => ({
          id: p.id,
          // Per-tenant display_name overrides the catalog label
          // ("Sign in with Acme Google" instead of "Sign in with Google").
          label: p.display_name ?? p.label,
        }))
      : providers.map((p) => ({ id: p.id, label: p.label }));

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
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* The home page's hero, as an ink island. */}
      <div
        className="dark relative hidden overflow-hidden bg-cover text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{
          backgroundImage:
            // Dark at both ends: the headline sits at the bottom and the
            // wordmark at the top, over what is bright sky in the photo.
            "linear-gradient(to top, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.3) 45%, rgba(10,10,15,0.72) 100%), " +
            "url('/images/home-hero.jpg'), " +
            "linear-gradient(135deg, #2b1a1e 0%, #1a1214 50%, #0a0508 100%)",
          backgroundColor: "#0a0508",
          // The photo is landscape and this panel is portrait, so `cover`
          // crops it hard; centred, the crop is dark tarmac and the
          // aircraft (right of centre in the photo) is cut off.
          backgroundPosition: "68% center",
        }}
      >
        <HomeWordmark size={40} wordmark="PEREGRINE" subtitle="FLIGHT OPS" />
        <div className="max-w-md">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-brand-light">
            Part 135 operations
          </p>
          <p className="mt-3 text-3xl font-bold leading-tight tracking-tight">
            Dispatch, flight following and compliance, in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-foreground/75">
            Releases, crew, weather, maintenance and the records an
            inspector asks for — built for the way your bases fly.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <HomeWordmark size={36} wordmark="PEREGRINE" subtitle="FLIGHT OPS" />
          </div>

          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary">
            Flight Operations
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your company account.
          </p>

          {error && (
            <div
              className="mt-6 flex items-center gap-2 rounded-md border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red"
              role="alert"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="flex-shrink-0"
                aria-hidden
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            {visibleProviders.length > 0 && (
              <>
                <div className="mb-4 space-y-2">
                  {visibleProviders.map((p) => (
                    <SsoButton
                      key={p.id}
                      provider={p}
                      callbackUrl={from}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
                    or use password
                  </span>
                  <div className="h-px flex-1 bg-border" />
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
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="ff-input py-2.5 text-sm"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-status-red" role="alert">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="ff-input py-2.5 text-sm"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-status-red" role="alert">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="mt-2 w-full"
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Authorized users only &mdash; contact your administrator for
            access.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The shape this component needs — narrower than ProviderSummary or
 * SsoResolveProvider so the same button works for both the env-driven
 * and resolved-per-tenant providers. `label` here is either the
 * catalog label (env path) or the per-tenant display_name override
 * (resolved path).
 */
interface SsoButtonProvider {
  id: string;
  label: string;
}

/**
 * Brand-coloured SSO button per provider, matching the legacy login.html
 * styling (Microsoft / Google / Okta each get their own pill colors).
 *
 * The button text reads "Sign in with <label>" — for env-driven the
 * label is the catalog default ("Google"), for tenant-resolved it's
 * whatever display_name the admin configured ("Sign in with Acme
 * Google" if the admin overrode the label, or just "Google" if not).
 */
function SsoButton({
  provider,
  callbackUrl,
  disabled,
}: {
  provider: SsoButtonProvider;
  callbackUrl: string;
  disabled?: boolean;
}) {
  const style = SSO_STYLES[provider.id] ?? SSO_STYLES.default;
  // When the per-tenant display_name already starts with "Sign in"
  // (e.g. "Sign in with Acme Corp") don't double the prefix.
  const renderedLabel = /^sign\s*in/i.test(provider.label)
    ? provider.label
    : `Sign in with ${provider.label}`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => signIn(provider.id, { callbackUrl })}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-md p-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      style={style}
    >
      <ProviderIcon providerId={provider.id} />
      {renderedLabel}
    </button>
  );
}

/**
 * Brand-mark SVGs for each provider. Drawn inline so we don't need an
 * external asset pipeline — small enough that bundle bloat isn't a
 * concern. All three are pulled from the official brand guidelines:
 *   Google     — full-colour "G" (Google identity guidelines)
 *   Microsoft  — 4-square logo (Microsoft brand guidelines)
 *   Okta       — white wordmark "O" on the blue button
 */
function ProviderIcon({ providerId }: { providerId: string }) {
  if (providerId === "google") {
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    );
  }
  if (providerId === "microsoft-entra-id") {
    return (
      <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
    );
  }
  if (providerId === "okta") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="#fff">
        <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 4a4 4 0 110 8 4 4 0 010-8z" />
      </svg>
    );
  }
  return null;
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
