"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemeSwitch } from "@/components/theme/theme-switch";
import { cn } from "@/lib/utils";

import { Wordmark } from "./wordmark";

const LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Operations", href: "#operations" },
  { label: "Load planning", href: "#load" },
];

/**
 * The landing page's nav, in ForeFlight's manner (#78): transparent over the
 * hero, solid chrome once the page scrolls; UPPERCASE tracked links; an
 * outlined Sign in beside a solid call to action. A dark island in both
 * modes, as ForeFlight's is.
 */
export function LandingNav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const update = () => setSolid(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "dark fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "bg-chrome" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1180px] items-center gap-10 px-5 sm:px-8">
        <Link href="/" aria-label="Peregrine Flight Ops, home" className="flex-shrink-0">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-white/90 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeSwitch className="hidden md:inline-flex" />
          <Link
            href="/login"
            className="btn-caps rounded-md border-2 border-white/80 px-4 py-[0.4rem] text-white transition-colors hover:bg-white hover:text-chrome"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
