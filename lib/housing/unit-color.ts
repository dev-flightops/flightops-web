/**
 * A housing unit's accent colour, as the calendar paints it.
 *
 * The default was Tailwind blue-500 (#3b82f6), picked for the old navy
 * theme. On the light ground white text on it is 3.7:1, so the default
 * is now the theme's light status-blue, where white text is 6.7:1. An
 * operator's own colour is used as given — the text colour adapts to it
 * (lib/theme/contrast.ts) instead.
 */
export const DEFAULT_UNIT_COLOR = "#1d4ed8";

const HEX = /^#[0-9a-f]{6}$/i;

export function unitColor(accent: string | null | undefined): string {
  return accent && HEX.test(accent) ? accent : DEFAULT_UNIT_COLOR;
}
