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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Fuel Management</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Order fuel, manage suppliers, track pricing, view orders across all
          bases
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <StatTile label="Open orders" value={openOrders} accent={openOrders > 0 ? "yellow" : undefined} />
        <StatTile label="Suppliers" value={activeSuppliers} />
        <StatTile label="Fuel types" value={activeTypes} />
        <StatTile label="Quality logs" value="—" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          title="Orders"
          blurb="Place fuel orders by aircraft + base; track status through confirm and fueled."
          links={[
            { label: "+ Order Fuel", sublabel: "New fuel order", href: "/fuel/orders/new", primary: true },
            { label: "All Orders", sublabel: `${openOrders} open`, href: "/fuel/orders" },
          ]}
        />
        <SectionCard
          title="Suppliers & Pricing"
          blurb="Vendor directory with contract pricing per base + fuel type."
          links={[
            { label: "Suppliers", sublabel: `${activeSuppliers} active`, href: "/fuel/suppliers" },
          ]}
        />
        <SectionCard
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
    <div className="flex min-w-0 flex-col border-l-2 border-input py-1 pl-3">
      <div className={`font-display text-[1.75rem] font-extrabold leading-none tabular-nums ${valueClass}`}>{value}</div>
      <div className="eyebrow mt-1.5">
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
  title,
  blurb,
  links,
}: {
  title: string;
  blurb: string;
  links: SectionLink[];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <Link
              href={link.href}
              className={
                link.primary
                  ? "flex items-center justify-between rounded-md border border-primary/40 bg-background px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                  : "flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm text-foreground hover:border-primary/60 hover:bg-primary/5"
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
