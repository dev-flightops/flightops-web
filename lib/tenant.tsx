/**
 * Tenant context — exposes the user's tenant list and current tenant to client
 * components, and provides a `switchTenant(id)` action that calls the backend
 * to re-issue the JWT scoped to a different tenant.
 *
 * Scaffold note (M1-G-6): the User schema is 1-user-1-tenant today, so the
 * tenant list always has exactly one entry. The provider, hook, and switcher
 * UI are designed so that when multi-tenant memberships land later, no
 * frontend changes are required — the backend will just start returning
 * multiple rows from /auth/me/tenants.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type { TenantSummary } from "@/lib/api/types";

interface TenantContextValue {
  /** All tenants the user can access. Currently always length 1. */
  tenants: TenantSummary[];
  /** The tenant the session JWT is currently scoped to. */
  currentTenant: TenantSummary;
  /** Whether more than one tenant is available — drives showing the switcher. */
  isMultiTenant: boolean;
  /** Whether a switch is currently in flight. */
  isSwitching: boolean;
  /** Request the backend to re-issue the JWT scoped to `tenantId`. */
  switchTenant: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export interface TenantProviderProps {
  tenants: TenantSummary[];
  /** Server action wired by the layout that owns the session. */
  switchTenantAction: (tenantId: string) => Promise<void>;
  children: ReactNode;
}

export function TenantProvider({
  tenants: initialTenants,
  switchTenantAction,
  children,
}: TenantProviderProps) {
  const [tenants] = useState(initialTenants);
  const [isPending, startTransition] = useTransition();

  const currentTenant = useMemo(() => {
    const found = tenants.find((t) => t.is_current);
    if (!found) {
      // This should be impossible: the backend always marks exactly one row
      // as is_current. Falling back to the first entry keeps the UI rendering
      // rather than throwing if a stale session ever arrives.
      return tenants[0];
    }
    return found;
  }, [tenants]);

  const switchTenant = useCallback(
    (tenantId: string) =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          await switchTenantAction(tenantId);
          resolve();
        });
      }),
    [switchTenantAction],
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      currentTenant,
      isMultiTenant: tenants.length > 1,
      isSwitching: isPending,
      switchTenant,
    }),
    [tenants, currentTenant, isPending, switchTenant],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === null) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return ctx;
}
