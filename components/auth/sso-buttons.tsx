"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import type { ProviderSummary } from "@/lib/api/types";

interface SsoButtonsProps {
  providers: ProviderSummary[];
  /** Where to send the user after a successful OAuth round-trip. */
  callbackUrl?: string;
}

/**
 * Renders one button per enabled SSO provider. The button list is server-
 * driven (`GET /auth/providers`) so the UI never offers a flow the backend
 * isn't configured to complete.
 *
 * Layout intentionally minimal — separator + buttons. Drop into the login
 * card below the credentials form.
 */
export function SsoButtons({ providers, callbackUrl = "/" }: SsoButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="sso-buttons">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn(provider.id, { callbackUrl })}
          >
            Sign in with {provider.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
