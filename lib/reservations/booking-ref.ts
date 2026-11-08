/** A booking's number as the screens show it, like a charter's CHR-. */
export function bookingRef(id: string): string {
  return `BK-${id.slice(0, 8).toUpperCase()}`;
}
