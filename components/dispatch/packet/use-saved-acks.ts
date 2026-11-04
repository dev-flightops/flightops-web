"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { saveAcknowledgmentsAction, type AckChange } from "@/app/(app)/dispatch/ack-actions";
import type { AckKind } from "@/lib/api/types";

/** How long ticks in a row wait for the next before they are saved. */
export const TICK_SETTLE_MS = 500;

type SaveScope = {
  flightId: string;
  kind: AckKind;
  queue: Map<string, AckChange>;
  writing: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  attached: boolean;
  flush: () => void;
};
type View = {
  scope: SaveScope;
  ticked: ReadonlyMap<string, boolean>;
  pending: boolean;
  error: string | null;
};

/**
 * Save the dispatcher's ticks without blocking further input (#70, #155).
 * A slow tick must finish before its later untick reaches the server.
 * Each flight/kind owns its queue and optimistic state; a new packet must
 * never inherit another flight's acknowledgments. Refresh only after the
 * queue drains, rather than reloading the packet between rapid changes.
 */
export function useSavedAcks(flightId: string, kind: AckKind, saved: ReadonlySet<string>) {
  const router = useRouter();
  const scope = useMemo<SaveScope>(() => ({
    flightId, kind, queue: new Map(), writing: new Set(), timer: null,
    running: false, attached: true, flush: () => {},
  }), [flightId, kind]);
  const [view, setView] = useState<View>(() => ({ scope, ticked: new Map(), pending: false, error: null }));
  const current = view.scope === scope ? view : { scope, ticked: new Map<string, boolean>(), pending: false, error: null };
  const update = (change: (prev: View) => View) => {
    setView((prev) => {
      if (!scope.attached) return prev;
      return change(prev.scope === scope ? prev : { scope, ticked: new Map(), pending: false, error: null });
    });
  };

  const savedKey = Array.from(saved).sort().join("\n");
  useEffect(() => {
    const shown = new Set(savedKey ? savedKey.split("\n") : []);
    setView((prev) => {
      if (prev.scope !== scope) return prev;
      const still = Array.from(prev.ticked).filter(([key, on]) =>
        scope.queue.has(key) || scope.writing.has(key) || shown.has(key) !== on,
      );
      return still.length === prev.ticked.size ? prev : { ...prev, ticked: new Map(still) };
    });
  }, [savedKey, scope, current.pending]);
  useEffect(() => {
    scope.attached = true;
    return () => {
      scope.attached = false;
      if (scope.timer) clearTimeout(scope.timer);
      scope.timer = null;
      // Finish the last choice against its original flight even when
      // navigation happens inside the debounce window.
      scope.flush();
    };
  }, [scope]);

  const flush = () => {
    scope.timer = null;
    if (scope.running) return;
    const changes = Array.from(scope.queue.values());
    scope.queue.clear();
    if (changes.length === 0) return;
    scope.running = true;
    scope.writing = new Set(changes.map((c) => c.key));
    void (async () => {
      try {
        const result = await saveAcknowledgmentsAction(scope.flightId, changes);
        const newer = new Set(scope.queue.keys());
        update((prev) => {
          const ticked = new Map(prev.ticked);
          if (!result.ok) {
            // An older refusal must not roll back a newer queued choice.
            for (const c of changes) if (!newer.has(c.key)) ticked.delete(c.key);
          }
          return { ...prev, ticked, error: result.ok ? null : result.error };
        });
      } catch {
        const newer = new Set(scope.queue.keys());
        update((prev) => {
          const ticked = new Map(prev.ticked);
          for (const c of changes) if (!newer.has(c.key)) ticked.delete(c.key);
          return { ...prev, ticked, error: "The acknowledgment wasn't saved. Try again." };
        });
      } finally {
        scope.running = false;
        scope.writing.clear();
        if (scope.queue.size > 0) {
          // The debounce may already have expired during the first save.
          if (!scope.timer) scope.flush();
        } else {
          update((prev) => ({ ...prev, pending: false }));
          if (scope.attached) router.refresh();
        }
      }
    })();
  };
  scope.flush = flush;

  const change = (
    keys: string[],
    on: boolean,
    detail?: (key: string) => Record<string, unknown> | null,
    settle = TICK_SETTLE_MS,
  ) => {
    update((prev) => {
      const ticked = new Map(prev.ticked);
      for (const key of keys) ticked.set(key, on);
      return { ...prev, ticked, pending: true, error: null };
    });
    for (const key of keys) scope.queue.set(key, { kind: scope.kind, key, on, detail: detail?.(key) ?? null });
    if (scope.timer) clearTimeout(scope.timer);
    scope.timer = setTimeout(flush, settle);
  };

  return {
    isOn: (key: string) => current.ticked.get(key) ?? saved.has(key),
    change, pending: current.pending, error: current.error,
  };
}
