import { renderHook, act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TenantSummary } from "@/lib/api/types";

import { TenantProvider, useTenant } from "./tenant";

const acme: TenantSummary = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Acme Aviation",
  slug: "acme",
  plan: "starter",
  is_current: true,
};

const beta: TenantSummary = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Beta Charter",
  slug: "beta",
  plan: "owner",
  is_current: false,
};

const wrapWithProvider = (
  tenants: TenantSummary[],
  switchTenantAction = vi.fn().mockResolvedValue(undefined),
) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TenantProvider tenants={tenants} switchTenantAction={switchTenantAction}>
      {children}
    </TenantProvider>
  );
  return { wrapper, switchTenantAction };
};

describe("TenantProvider / useTenant", () => {
  it("exposes the tenant marked is_current as the current tenant", () => {
    const { wrapper } = wrapWithProvider([acme]);
    const { result } = renderHook(() => useTenant(), { wrapper });

    expect(result.current.currentTenant.id).toBe(acme.id);
    expect(result.current.tenants).toHaveLength(1);
    expect(result.current.isMultiTenant).toBe(false);
  });

  it("reports isMultiTenant=true when more than one tenant is available", () => {
    const { wrapper } = wrapWithProvider([acme, beta]);
    const { result } = renderHook(() => useTenant(), { wrapper });

    expect(result.current.isMultiTenant).toBe(true);
    expect(result.current.currentTenant.id).toBe(acme.id);
  });

  it("invokes the server action when switchTenant is called", async () => {
    const { wrapper, switchTenantAction } = wrapWithProvider([acme, beta]);
    const { result } = renderHook(() => useTenant(), { wrapper });

    await act(async () => {
      await result.current.switchTenant(beta.id);
    });

    expect(switchTenantAction).toHaveBeenCalledWith(beta.id);
  });

  it("throws a clear error when useTenant is used outside the provider", () => {
    // Suppress React's automatic error log for this assertion
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTenant())).toThrow(
      /useTenant must be used within a TenantProvider/,
    );
    spy.mockRestore();
  });

  it("falls back to the first tenant when none are marked is_current", () => {
    // Defensive path — backend always returns one is_current, but we don't
    // want the UI to throw on a stale session.
    const noneCurrent: TenantSummary[] = [
      { ...acme, is_current: false },
      { ...beta, is_current: false },
    ];
    const { wrapper } = wrapWithProvider(noneCurrent);
    const { result } = renderHook(() => useTenant(), { wrapper });

    expect(result.current.currentTenant.id).toBe(acme.id);
  });

  it("renders provider children", () => {
    render(
      <TenantProvider tenants={[acme]} switchTenantAction={vi.fn()}>
        <span data-testid="child">hello</span>
      </TenantProvider>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });
});
