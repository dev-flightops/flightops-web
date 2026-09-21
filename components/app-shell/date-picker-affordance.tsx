"use client";

import { useEffect } from "react";

/**
 * Clicking a date field anywhere opens its calendar.
 *
 * Reported 9/17: "When putting in a flight for dispatch, the calendar
 * isn't visible until you click on the far right side of the box."
 *
 * That is stock browser behaviour for `<input type="date">` and
 * `datetime-local`: the calendar only opens from the small icon at the
 * trailing edge. Clicking the text itself selects a segment to type
 * into, which gives no hint that a picker exists at all. On the New
 * Flight form the two fields a dispatcher has to fill — ETD and ETA —
 * are both datetime-local, so the complaint lands on the exact screen
 * used to put a flight in.
 *
 * One document-level listener rather than a prop on each input. There
 * are two dozen date fields across the app and no shared input
 * component to hang this off, and four of the forms holding them are
 * server components, which cannot take an onClick at all. A listener
 * here covers every one of them, including those four, and adds nothing
 * to any form's code.
 *
 * `showPicker()` needs user activation, which a click handler has. It
 * throws on an input that is detached or of a type without a picker, so
 * the call is guarded — a throw here would otherwise break the click
 * handler for the whole document.
 *
 * Not verified visually: the picker is drawn by the browser, not the
 * page, so it does not appear in a headless screenshot. What was
 * checked in a real browser session is that the call is reached from a
 * click on the field's text area and returns without throwing.
 */

const PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

export function DatePickerAffordance() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const el = event.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (!PICKER_TYPES.has(el.type)) return;
      // A disabled field is inert and a readonly one is not the user's
      // to change; opening a picker over either would imply otherwise.
      if (el.disabled || el.readOnly) return;
      try {
        el.showPicker();
      } catch {
        // Older browser, or a type this one has no picker for. The
        // trailing icon still works, and typing was never affected.
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
