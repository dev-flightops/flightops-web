"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
import { useRef } from "react";

import { useTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

/**
 * Compact tenant switcher for the AppShell header.
 *
 * Built on native <details>/<summary> rather than a Radix Popover to keep this
 * scaffold dep-free. The disclosure pattern is keyboard-accessible out of the
 * box: Enter/Space opens, Escape via click-outside doesn't apply but the
 * close-on-select handler covers the common path. When we add a proper menu
 * primitive (probably with @radix-ui/react-dropdown-menu in M2), this swaps
 * in without changing the public API.
 */
export function TenantSwitcher() {
  const { tenants, currentTenant, isMultiTenant, isSwitching, switchTenant } =
    useTenant();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (!currentTenant) return null;

  const handleSelect = async (tenantId: string) => {
    if (tenantId !== currentTenant.id) {
      await switchTenant(tenantId);
    }
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details
      ref={detailsRef}
      className="group relative"
      data-testid="tenant-switcher"
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSwitching && "opacity-60",
          !isMultiTenant && "cursor-default hover:bg-card",
        )}
        aria-label={`Current organization: ${currentTenant.name}`}
        aria-haspopup={isMultiTenant ? "menu" : undefined}
        // Block the disclosure entirely when there's only one tenant — the
        // dropdown would be useless and confusing to keyboard users.
        onClick={(e) => {
          if (!isMultiTenant) e.preventDefault();
        }}
      >
        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="truncate max-w-[180px]">{currentTenant.name}</span>
        {isMultiTenant && (
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        )}
      </summary>

      {isMultiTenant && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-md border border-border bg-popover p-1 text-sm shadow-md"
        >
          {tenants.map((tenant) => {
            const isCurrent = tenant.id === currentTenant.id;
            return (
              <button
                key={tenant.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={isSwitching}
                onClick={() => handleSelect(tenant.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:bg-accent",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tenant.slug} · {tenant.plan}
                  </span>
                </span>
                {isCurrent && (
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </details>
  );
}
