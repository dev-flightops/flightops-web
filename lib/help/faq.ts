/**
 * Troubleshooting: the questions people ask when something won't do
 * what they expect (#114).
 *
 * The client named the first one: "Why won't my flight release?". Its
 * answer lists every refusal the release can give, worded as the packet
 * words it (app/(app)/dispatch/[flightId]/actions.ts), with what clears
 * each. Most questions about this product are "why does it not let me",
 * and the answer is a check doing its job, so each entry says what the
 * check is for as well as how it is properly cleared.
 *
 * Shown on /help, and part of what the help assistant answers from
 * (corpus.ts). Text may carry Markdown links to pages and **bold**.
 */

export interface FaqEntry {
  /** The anchor on /help: /help#faq-<slug>. */
  slug: string;
  question: string;
  answer: string;
  /** A list under the answer, when there is one. */
  points?: string[];
  /** The pages the answer sends people to. */
  pages: string[];
}

export const FAQ: FaqEntry[] = [
  {
    slug: "release-refused",
    question: "Why won't my flight release?",
    answer:
      "Every check has to pass before a flight is released, and a refused release names the check next to the **Generate PDF** button. Each message, and what clears it:",
    points: [
      "**This flight has already been released**, or **Cancelled flights cannot be released**: there is nothing to release.",
      "**The assigned aircraft is not active**: pick another aircraft in Flight Details, or ask an admin to make it active under Settings → Fleet.",
      "**Aircraft is not airworthy**: an open grounding squawk, an overdue inspection or an expired MEL item, listed under Maintenance & Airworthiness. Maintenance clears it by returning the aircraft to service.",
      "**This flight has no PIC on its crew**: pick one in Flight Details.",
      "**The flight's PIC changed since this page loaded**: reload the packet and review it again.",
      "**The assigned PIC has hard-block currency items**, or **the SIC has hard-block currency items**: for example an expired medical, an overdue check, or no qualification on the aircraft's type. Clear the item on the compliance board, or crew the flight with a current pilot. Where the company allows an override, a Chief Pilot, Director of Operations or Exec Admin records it from their own login.",
      "**There is no supervisor override on record**: the override has to be recorded by a Chief Pilot, Director of Operations or Exec Admin themselves.",
      "**Acknowledge the currency warnings first**: tick each warning the packet lists for the PIC and the SIC.",
      "**A pilot on this flight is past a 14 CFR 135.265 flight-time limit**: that pilot can't take this flight. Crew it with someone else.",
      "**NOTAMs not acknowledged for** a stop: tick the NOTAM acknowledgment for each stop named.",
      "**Below the company's dispatch minimums**: see [Why does it say the weather is below minimums?](/help#faq-below-minimums). Nothing can be acknowledged: the weather has to come up, or the flight goes another way.",
      "**The route has stale or missing weather**: refresh the weather. If it stays stale and you have checked conditions another way, acknowledge it on the weather panel.",
      "**Selected PIC isn't on this tenant's roster**: refresh the page and pick the PIC again.",
    ],
    pages: ["/dispatch", "/compliance/crew-currency", "/maintenance/squawks"],
  },
  {
    slug: "below-minimums",
    question: "Why does it say the weather is below minimums?",
    answer:
      "Some flights can only go VFR: an aircraft that isn't IFR certified, and any aircraft going to a village airport without an instrument approach. For those, the release is refused while the latest weather at a stop is below the company's dispatch minimums, 600 ft and 2 sm unless the company has set others under Settings → Flight Risk. The latest weather is the METAR or a village report from the last 6 hours, whichever is worse.",
    points: [
      "Which aircraft types aren't IFR certified is set under Settings → Flight Risk.",
      "Which village airports have an instrument approach is marked on [Village weather](/village-wx). They all start as having none.",
      "The packet says which stop and which report before anyone presses Release.",
    ],
    pages: ["/village-wx", "/settings/frat", "/dispatch"],
  },
  {
    slug: "frat-levels",
    question: "What do the FRAT levels mean?",
    answer:
      "The FRAT adds up its factor scores, and the total sets the level against your company's thresholds (Settings → Flight Risk). Out of the box:",
    points: [
      "**LOW**, under 15: go ahead.",
      "**MEDIUM**, 15 to 24: go ahead, with the mitigations noted.",
      "**HIGH**, 25 to 34: contact dispatch and record it before going on.",
      "**EXTREME**, 35 or more: a Chief Pilot or the Director of Operations has to authorize the flight.",
    ],
    pages: ["/flight-crew", "/settings/frat"],
  },
  {
    slug: "packet-and-frat",
    question: "Why does the dispatch packet show a different risk level from my FRAT?",
    answer:
      "They are scored differently. The packet's risk assessment takes its worst single row (severity times likelihood); the FRAT adds up all its factors. A FRAT is never filed at a lower level than the packet the flight was released on, so a HIGH packet means at least a HIGH FRAT.",
    pages: ["/dispatch", "/flight-crew"],
  },
  {
    slug: "pilot-not-available",
    question: "Why is a pilot shown with a problem in the crew panel?",
    answer:
      "Each pilot shows their standing for that seat on that aircraft. A hard block (an expired or missing medical, a first-class medical where the aircraft needs one, an overdue check, no qualification on the type) stops the release. A warning has to be acknowledged at release. The details are on [Crew currency](/compliance/crew-currency).",
    pages: ["/compliance/crew-currency", "/dispatch"],
  },
  {
    slug: "stale-weather",
    question: "The weather is marked stale. What should I do?",
    answer:
      "Refresh it on the dispatch packet's weather. A village report more than 2 hours old is flagged: ask the station for a new one on [Village weather](/village-wx). If the weather is still stale and you have checked conditions another way, the dispatcher acknowledges it at release, and the acknowledgment is recorded with the release.",
    pages: ["/dispatch", "/village-wx", "/weather"],
  },
  {
    slug: "passenger-seats",
    question: "Why can't I add another passenger?",
    answer:
      "A flight and its manifest are held to the aircraft's passenger seats (Settings → Fleet); crew don't count. In a Caravan, a tenth person may ride in the co-pilot seat only as a company check airman, entered on the manifest as crew. A no-show's seat is free again.",
    pages: ["/manifest", "/settings/fleet"],
  },
  {
    slug: "no-invoice",
    question: "Why didn't my flight raise an invoice?",
    answer:
      "Draft invoices are raised when a flight lands, for its bookings. None are raised when your company invoices in another system (Settings → Company → Invoicing). For a flown flight that should have them, press **Raise invoices** on [Invoicing](/invoicing) and pick the flight: it shows what was raised and what wasn't.",
    pages: ["/invoicing", "/settings/company"],
  },
  {
    slug: "cant-see-page",
    question: "Why can't I see a page or a menu item?",
    answer:
      "The menus show what your roles allow. If your work needs a page you can't see, ask your company administrator: roles are set under [Users](/settings/users).",
    pages: ["/settings/users"],
  },
  {
    slug: "cant-sign-in",
    question: "I can't sign in.",
    answer:
      "Ten wrong passwords for one account within five minutes lock it for 15 minutes: wait, then try again. There is no self-service password reset yet. An Exec Admin sets a new password under [Users](/settings/users).",
    pages: ["/settings/users"],
  },
  {
    slug: "local-time",
    question: "Are times local or Zulu?",
    answer:
      "Flight times are typed and shown in the local time of the departure base, and stored in UTC. A form that wants UTC says so on the field.",
    pages: ["/dispatch", "/flight-following/new"],
  },
];
