"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  spotlightSearch,
  type SpotlightGroup,
  type SpotlightHit,
} from "./spotlight-search-action";

/** Global spotlight search — Ctrl/⌘+K opens a centered command palette.
 *  Type to search across customers, aircraft, bookings, and flights.
 *  Arrow keys move the selection, Enter navigates. */
export function SpotlightSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SpotlightGroup[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd/Ctrl+K listener. Skip when typing in an input to avoid
  // stealing keystrokes from existing search fields on the page.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Flatten groups into an ordered list for keyboard nav.
  const flat = useMemo(() => {
    const acc: Array<SpotlightHit & { groupLabel: string }> = [];
    for (const g of groups) {
      for (const item of g.items) {
        acc.push({ ...item, groupLabel: g.label });
      }
    }
    return acc;
  }, [groups]);

  // Debounced query → server action.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setSelectedIndex(0);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await spotlightSearch(trimmed);
        setGroups(result);
        setSelectedIndex(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setGroups([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const navigate = (hit: SpotlightHit) => {
    setOpen(false);
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[selectedIndex];
      if (hit) navigate(hit);
    }
  };

  const trimmed = query.trim();
  const showEmpty = trimmed.length >= 2 && !pending && flat.length === 0;
  const showHint = trimmed.length < 2 && !pending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-[0.65rem] font-medium text-muted-foreground hover:bg-card sm:inline-flex"
        aria-label="Open search (Ctrl+K)"
        title="Search — Ctrl+K"
      >
        <SearchIcon />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1 py-0.5 font-mono text-[0.55rem] lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[15%] max-w-2xl translate-y-0 gap-0 p-0"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Spotlight search</DialogTitle>

          {/* pr-12 reserves the corner for DialogContent's own close button,
              which is absolutely positioned at right-4 top-4 and so takes no
              flex space. Without it the input text and the "Searching…"
              indicator run underneath the X. */}
          <div className="flex items-center gap-2 border-b border-border py-3 pl-4 pr-12">
            <SearchIcon className="text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search bookings, customers, aircraft…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            {pending ? (
              <span className="text-[0.65rem] text-muted-foreground">
                Searching…
              </span>
            ) : null}
            {/* No ESC badge here. The dialog already renders a close button
                in this exact corner, so the two sat on top of each other —
                and the footer below already says "Esc close", which made
                three ways to be told the same thing. The X stays because it
                is the only one of the three a mouse user can actually
                click. */}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {showHint ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            ) : null}
            {showEmpty ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No matches for &ldquo;{trimmed}&rdquo;.
              </div>
            ) : null}
            {groups.map((group) => {
              const startIndex = flat.findIndex(
                (h) => h.groupLabel === group.label,
              );
              return (
                <section key={group.key}>
                  <h3 className="border-b border-border/50 bg-muted/10 px-4 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {group.label}
                  </h3>
                  <ul>
                    {group.items.map((hit, i) => {
                      const globalIndex = startIndex + i;
                      const isSelected = globalIndex === selectedIndex;
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => navigate(hit)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={
                              "flex w-full flex-col items-start gap-0.5 border-b border-border/25 px-4 py-2.5 text-left transition-colors last:border-b-0 " +
                              (isSelected
                                ? "bg-status-blue/15 text-foreground"
                                : "text-foreground hover:bg-muted/20")
                            }
                          >
                            <span className="text-sm font-semibold">
                              {hit.label}
                            </span>
                            {hit.sublabel ? (
                              <span className="text-[0.7rem] text-muted-foreground">
                                {hit.sublabel}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card/40 px-4 py-2 text-[0.6rem] text-muted-foreground">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> open
            </span>
            <span>
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">
      {children}
    </kbd>
  );
}
