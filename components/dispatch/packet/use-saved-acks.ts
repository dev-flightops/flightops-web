"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { saveAcknowledgmentsAction, type AckChange } from "@/app/(app)/dispatch/ack-actions";
import type { AckKind } from "@/lib/api/types";

/** How long ticks in a row wait for the next before they are saved. */
export const TICK_SETTLE_MS = 500;

/**
 * Ticks on the dispatch packet, saved per dispatcher (#155).
 *
 * The client, 10/29: "Warning acknowledgments are stored in the page link
 * (URL), not recorded against the dispatcher ... Each warning
 * acknowledgment takes about 10 seconds to save. Clicks during the save
 * are dropped or untick a box that was already acknowledged, and the page
 * sometimes jumps to the top."
 *
 * A tick shows at once and is never undone by a save in flight; ticks in a
 * row are saved together once they stop, then the packet is refreshed from
 * what was saved (no change of address, so no jump). `saved` is the
 * viewer's own saved ticks, from the server.
 */
export function useSavedAcks(flightId: string, kind: AckKind, saved: ReadonlySet<string>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Ticks the server doesn't show yet, by key: what the box should read.
  const [ticked, setTicked] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const queue = useRef<Map<string, AckChange>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Once the server shows a tick, the box reads it from there again.
  const savedKey = Array.from(saved).sort().join("\n");
  useEffect(() => {
    const shown = new Set(savedKey ? savedKey.split("\n") : []);
    setTicked((prev) => {
      const still = Array.from(prev).filter(([key, on]) => shown.has(key) !== on);
      return still.length === prev.size ? prev : new Map(still);
    });
  }, [savedKey]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const isOn = (key: string) => ticked.get(key) ?? saved.has(key);

  const flush = () => {
    timer.current = null;
    const changes = Array.from(queue.current.values());
    queue.current.clear();
    if (changes.length === 0) return;
    startTransition(async () => {
      const result = await saveAcknowledgmentsAction(flightId, changes);
      if (!result.ok) {
        setError(result.error);
        setTicked((prev) => {
          const next = new Map(prev);
          for (const c of changes) next.delete(c.key);
          return next;
        });
      } else {
        setError(null);
      }
      router.refresh();
    });
  };

  const change = (
    keys: string[],
    on: boolean,
    detail?: (key: string) => Record<string, unknown> | null,
    settle = TICK_SETTLE_MS,
  ) => {
    setTicked((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, on);
      return next;
    });
    for (const key of keys) queue.current.set(key, { kind, key, on, detail: detail?.(key) ?? null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, settle);
  };

  return { isOn, change, pending, error };
}
