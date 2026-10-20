import { cn } from "@/lib/utils";

/**
 * Peregrine's wordmark (#78): the name in the display face, heavy and
 * tracked, with FLIGHT OPS set small beside it. Typographic on purpose —
 * an identity of its own rather than an emblem in someone else's manner.
 * Drawn for dark grounds (the nav and the footer are dark in both modes).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-2.5 text-white", className)}>
      <span className="font-display text-[1.4rem] font-extrabold uppercase leading-none tracking-[0.06em]">
        Peregrine
      </span>
      <span className="text-[0.62rem] font-bold uppercase leading-none tracking-[0.28em] text-white/75">
        Flight Ops
      </span>
    </span>
  );
}
