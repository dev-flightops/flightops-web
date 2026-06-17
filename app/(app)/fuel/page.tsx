import { Building2, Droplets, Fuel } from "lucide-react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listFuelOrders,
  listFuelSuppliers,
  listFuelTypes,
} from "@/lib/api/ground";

/**
 * /fuel — Fuel landing (M2-G-45).
 *
 * Mirrors the legacy `templates/fuel/index.html`-equivalent — quick
 * stats strip + section cards linking to the orders flow, supplier
 * directory, and the types/bases configuration.
 */
export default async function FuelLandingPage() {
  let openOrders = 0;
  let activeSuppliers = 0;
  let activeTypes = 0;
  let loadError: string | null = null;

  try {
    const [orders, suppliers, types] = await Promise.all([
      listFuelOrders({ status: "ordered", limit: 1 }),
      listFuelSuppliers(),
      listFuelTypes(),
    ]);
    openOrders = orders.total;
    activeSuppliers = suppliers.total;
    activeTypes = types.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Fuel data unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Fuel Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order fuel, manage suppliers, track pricing, view orders across all
          bases
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open orders" value={openOrders} accent={openOrders > 0 ? "yellow" : undefined} />
        <StatTile label="Suppliers" value={activeSuppliers} />
        <StatTile label="Fuel types" value={activeTypes} />
        <StatTile label="Quality logs" value="—" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon={<Fuel className="h-6 w-6 text-status-blue/80" strokeWidth={1.5} />}
          title="Orders"
          blurb="Place fuel orders by aircraft + base; track status through confirm and fueled."
          links={[
            { label: "+ Order Fuel", sublabel: "New fuel order", href: "/fuel/orders/new", primary: true },
            { label: "All Orders", sublabel: `${openOrders} open`, href: "/fuel/orders" },
          ]}
        />
        <SectionCard
          icon={<Building2 className="h-6 w-6 text-status-blue/80" strokeWidth={1.5} />}
          title="Suppliers & Pricing"
          blurb="Vendor directory with contract pricing per base + fuel type."
          links={[
            { label: "Suppliers", sublabel: `${activeSuppliers} active`, href: "/fuel/suppliers" },
          ]}
        />
        <SectionCard
          icon={<Droplets className="h-6 w-6 text-status-blue/80" strokeWidth={1.5} />}
          title="Fuel Types"
          blurb="Tenant's fuel catalog — Jet A, 100LL, mogas, etc."
          links={[
            { label: "Types & Bases", sublabel: `${activeTypes} active types`, href: "/fuel/types" },
          ]}
        />
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "yellow";
}) {
  const valueClass =
    accent === "yellow" ? "text-status-yellow" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

interface SectionLink {
  label: string;
  sublabel?: string;
  href: string;
  primary?: boolean;
}

function SectionCard({
  icon,
  title,
  blurb,
  links,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  links: SectionLink[];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <Link
              href={link.href}
              className={
                link.primary
                  ? "flex items-center justify-between rounded-md border border-status-blue bg-status-blue/15 px-3 py-2.5 text-sm font-semibold text-status-blue hover:bg-status-blue/20"
                  : "flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-foreground hover:border-status-blue/60 hover:bg-status-blue/5"
              }
            >
              <span>
                <span className="font-semibold">{link.label}</span>
                {link.sublabel && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {link.sublabel}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
