"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * What the page is showing that Peregrine Assistant should know (#138):
 * its notices that something isn't set up, and that something failed to
 * load, in the page's own words.
 *
 * Greg, 28 Oct: "if user ask to ai chatbot, ai chatbot also have to
 * answer." A question asked from the page goes with these, so "why won't
 * it open?" is answered about the aircraft that has no cruise speed, not
 * in general. A notice shows itself here while it is on screen
 * (`useOnScreen`); the assistant reads them as the question is sent.
 *
 * The service takes a few short ones (services/ai/app/routes/help.py):
 * MAX_NOTICES of MAX_NOTICE_CHARS at most, the first ones shown first.
 */

export const MAX_NOTICES = 8;
export const MAX_NOTICE_CHARS = 400;

const shown = new Map<number, string>();
const listeners = new Set<() => void>();
const NONE: readonly string[] = [];
let snapshot: readonly string[] = NONE;
let next = 0;

function changed() {
  const texts = [...new Set(shown.values())];
  snapshot = texts.length ? texts : NONE;
  listeners.forEach((listener) => listener());
}

/** Show a notice's text until the returned function is called. */
export function showOnScreen(text: string): () => void {
  const id = ++next;
  shown.set(id, text);
  changed();
  return () => {
    shown.delete(id);
    changed();
  };
}

/** The notices on screen now, as the assistant sends them. */
export function onScreenNotices(): string[] {
  return snapshot
    .slice(0, MAX_NOTICES)
    .map((text) => (text.length > MAX_NOTICE_CHARS ? `${text.slice(0, MAX_NOTICE_CHARS - 1)}…` : text));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The notices on screen, kept current: for the assistant's suggestions. */
export function useOnScreenNotices(): readonly string[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => NONE);
}

/** Show `text` while the component is on screen; nothing when null. */
export function useOnScreen(text: string | null): void {
  useEffect(() => (text ? showOnScreen(text) : undefined), [text]);
}
