"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";

/** Right-side sheet host for the "new booking" flow triggered from an
 *  empty-cell click on the Fleet Board. Mirrors BookingDrawerShell but
 *  strips a different set of URL params on close (new, aircraft_id, t). */
export function NewBookingDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onOpenChange = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("new");
    next.delete("aircraft_id");
    next.delete("t");
    router.replace(next.toString() ? `?${next.toString()}` : "?", {
      scroll: false,
    });
  };

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby={undefined}
        className="flex flex-col gap-0 overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
