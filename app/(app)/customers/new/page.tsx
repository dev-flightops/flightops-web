import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

import { CustomerForm } from "./customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/customers" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Customers
        </Link>
        <h1 className="mt-2 page-title">
          New Customer
        </h1>
      </header>
      <CustomerForm />
    </div>
  );
}
