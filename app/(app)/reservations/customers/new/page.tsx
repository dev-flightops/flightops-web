import Link from "next/link";

import { CustomerForm } from "./customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/reservations/customers" className="hover:text-foreground">
            ← Customers
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          New Customer
        </h1>
      </header>
      <CustomerForm />
    </div>
  );
}
