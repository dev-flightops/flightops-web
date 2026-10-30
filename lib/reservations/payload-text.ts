/** "1,507 lb left", or "120 lb over" when the flight is over already
 *  (#153). Pure, for the search results and the booking form. */
export function payloadLeftText(lbs: number): string {
  return lbs < 0 ? `${(-lbs).toLocaleString("en-US")} lb over` : `${lbs.toLocaleString("en-US")} lb left`;
}
