"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { AiTool } from "./modules";

/**
 * The AI Tools dropdown in the top bar.
 *
 * Legacy's `templates/base.html:287-294` — a purple sparkle button
 * opening a short list of the AI tools, available from every page. Our
 * version had a single link straight to FleetBrain, which left the
 * other tools reachable only through the Admin department nav. That
 * hid Safety Intelligence from safety officers, who are not admitted
 * to Admin and are exactly who the tool is for.
 *
 * The list arrives already filtered to what the caller's roles can
 * use, so this component never offers a tool the service will refuse.
 *
 * With one tool it renders as a plain link rather than a menu of one —
 * a dropdown that opens to a single item is a click nobody needed.
 */
export function AiToolsMenu({ tools }: { tools: AiTool[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Escape as well as outside-click: the button is reachable by
    // keyboard, so the menu has to be dismissible the same way.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (tools.length === 0) return null;

  if (tools.length === 1) {
    return (
      <Link
        href={tools[0].href}
        title={tools[0].label}
        aria-label="AI Assistant"
        className="hidden items-center justify-center rounded-md bg-transparent p-2 text-status-purple hover:bg-primary/8 sm:inline-flex"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="AI tools"
        aria-label="AI Assistant"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-md bg-transparent p-2 text-status-purple hover:bg-primary/8"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="AI tools"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-status-purple/30 bg-card p-2 shadow-lg"
        >
          <p className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.06em] text-status-purple">
            AI Tools
          </p>
          {tools.map((t) => (
            <Link
              key={t.id}
              role="menuitem"
              href={t.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-status-purple/10"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
