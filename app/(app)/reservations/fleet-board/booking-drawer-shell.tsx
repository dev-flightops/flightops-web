"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";

/** Right-side sheet that hosts the async booking-detail server component.
 *  Open state is derived from URL: when the parent renders this, the
 *  ?booking=<id> param is present, so we start open. Closing removes the
 *  param, which unmounts the parent and this shell. */
export function BookingDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onOpenChange = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("booking");
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
