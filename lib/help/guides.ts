import type { Role } from "@/lib/roles";

/**
 * Step-by-step how-to guides, by task (#114).
 *
 * The client asked for "short, step-by-step how-to guides ... organized
 * by role (e.g., 'How to release a flight,' 'How to file a FRAT,' 'How
 * to write up a squawk')". The page articles in catalogue.ts explain
 * one screen each; a guide follows one job across the screens it
 * touches, in the order somebody does it.
 *
 * Written against the screens as they are: every button and panel name
 * here is the label the app shows, checked in the code when written.
 * Shown on /help, and part of what the help assistant answers from
 * (corpus.ts). Text may carry Markdown links to pages and **bold**.
 */

export interface Guide {
  /** The anchor on /help: /help#guide-<slug>. */
  slug: string;
  title: string;
  /** Who does this job. Descriptive, like the catalogue's whoCanUse:
   *  each page's own check decides access. */
  roles: Role[];
  /** One sentence: what the guide gets done. */
  summary: string;
  steps: string[];
  /** What people get wrong, or ask next. */
  notes?: string[];
  /** The pages the job is done on. */
  pages: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "build-a-flight",
    title: "Build a flight",
    roles: ["dispatcher", "director_of_operations", "exec_admin"],
    summary: "Put a new flight on the board with its route, aircraft and times.",
    steps: [
      "On [Dispatch](/dispatch), press **+ New Flight**. It opens [Open New Flight](/flight-following/new), which Flight Following uses too.",
      "Enter the flight number, then the origin and destination as ICAO codes or FAA identifiers (9Z8 for Levelock, for example).",
      "Round trip is on, so once the destination is in, a last leg back to the origin is added. Untick **Round trip** for a one-way flight, and add any stops before the way home.",
      "Pick the aircraft. The times fill in from its cruise speed (Settings → Fleet) with the **Ground time at each stop**, 15 minutes unless changed. Type a time to change it: a time you typed is never overwritten.",
      "Enter the passengers and cargo, then press **Open Flight**.",
    ],
    notes: [
      "A flight can't carry more passengers than the aircraft's passenger seats (Settings → Fleet). Crew don't count.",
      "Times are typed and shown in the departure base's local time.",
      "Bookings waiting for a flight are listed under **Awaiting a flight** on Dispatch.",
      "To change the route later, or cancel the flight, see [Pull back or cancel a flight](/help#guide-pull-back-or-cancel-a-flight).",
    ],
    pages: ["/dispatch", "/flight-following/new"],
  },
  {
    slug: "release-a-flight",
    title: "Release a flight",
    roles: ["dispatcher", "director_of_operations", "exec_admin"],
    summary: "Work the dispatch packet and release the flight to its crew.",
    steps: [
      "Open the flight from the board on [Dispatch](/dispatch), or pull it in under **Load from Schedule**.",
      "In **Flight Details**, check the route and times and pick the PIC, and the SIC when the flight needs one. Each pilot shows their standing for that seat on this aircraft, and a hard block names its reason.",
      "Read **Weather & ATIS**: each stop's METAR, TAF and PIREPs, and the latest village report. Refresh weather that has aged.",
      "Under **NOTAM Acknowledgment**, review the NOTAMs and tick every stop.",
      "Check **Maintenance & Airworthiness** for open squawks and MEL items. A grounding squawk or an overdue inspection stops the release.",
      "Work the **Risk Assessment**. Most rows score themselves from the weather, runways, MELs and the load; answer the questions only you can, and add your notes.",
      "Press **Generate PDF**, read the confirmation, then **Release & generate**. The flight is released, the pilot sees the release, and the dispatch packet opens.",
    ],
    notes: [
      "A refused release says why next to the button. Every reason, and how it is cleared, is in [Why won't my flight release?](/help#faq-release-refused).",
      "The packet keeps the weather, risk and AAWU charts as they were at release, so printing it later shows what the flight was released on.",
      "To take a release back before departure, see [Pull back or cancel a flight](/help#guide-pull-back-or-cancel-a-flight).",
    ],
    pages: ["/dispatch"],
  },
  {
    slug: "file-a-frat",
    title: "File a FRAT",
    roles: ["pilot", "chief_pilot", "check_airman"],
    summary: "Score the flight's risk in the preflight before you accept it.",
    steps: [
      "On [Flight Crew](/flight-crew), open your flight under **My Flights** to start its preflight.",
      "Work steps 1 to 3 first: the dispatch release, weight and balance, and weather and NOTAMs. The FRAT is step 4.",
      "Score each factor from 0 to 5 in its group: pilot, aircraft, environment, external and route. Ceiling, visibility and wind come filled in from the route's METARs and the village reports of the last 6 hours, with the source named. Change any score that doesn't match what you see.",
      "Note how you will mitigate anything scored high.",
      "Submit. The total sets the level, against your company's thresholds (Settings → Flight Risk): LOW, MEDIUM, HIGH or EXTREME.",
      "At HIGH, contact dispatch and record it. At EXTREME, a Chief Pilot or the Director of Operations has to authorize the flight before you can go on.",
    ],
    notes: [
      "The FRAT is never filed at a lower level than the dispatch packet the flight was released on.",
      "For a flight that has to go VFR (an aircraft not IFR certified, or a field without an instrument approach), weather below the company's dispatch minimums scores 5: over company limits.",
      "The levels are explained in [What do the FRAT levels mean?](/help#faq-frat-levels).",
    ],
    pages: ["/flight-crew"],
  },
  {
    slug: "write-up-a-squawk",
    title: "Write up a squawk",
    roles: ["pilot", "maintenance", "director_of_maintenance", "dispatcher"],
    summary: "Report a defect on an aircraft, with or without a flight.",
    steps: [
      "On [Flight Crew](/flight-crew), under **At the aircraft**, press **+ Squawk**. The same button is in a flight's preflight, and on the dispatch packet under **Maintenance & Airworthiness**.",
      "Pick the aircraft, give the squawk a short title, and describe what you saw, where, and under what conditions.",
      "Choose the severity: **Minor** (cosmetic or advisory), **Major** (fix by the next scheduled maintenance) or **Grounding** (blocks dispatch).",
      "Press **File squawk**. You are recorded as the reporter.",
    ],
    notes: [
      "A grounding squawk takes the aircraft out of service at once. No flight on it can be released until maintenance returns it to service.",
      "Maintenance works squawks from [Squawks](/maintenance/squawks).",
    ],
    pages: ["/flight-crew", "/maintenance/squawks"],
  },
  {
    slug: "start-and-end-your-duty-day",
    title: "Start and end your duty day",
    roles: ["pilot", "crew_member"],
    summary: "Duty in when your day starts and out when it ends.",
    steps: [
      "On [Flight Crew](/flight-crew), press **DUTY IN** when your duty day starts.",
      "Watch the warnings under the button: they tell you when you are getting close to a duty limit.",
      "Press **DUTY OUT** when your day ends.",
    ],
    notes: [
      "Found something on the walk-around or the run-up? Squawk it from **At the aircraft** on the same page: see [Write up a squawk](/help#guide-write-up-a-squawk).",
    ],
    pages: ["/flight-crew"],
  },
  {
    slug: "check-in-passengers",
    title: "Check passengers in at the gate",
    roles: ["ground_ops", "reservations_agent", "dispatcher"],
    summary: "Check passengers in, mark no-shows and board the flight.",
    steps: [
      "Open the flight on [Manifest](/manifest) and press **Gate Check-in**.",
      "For each passenger, press **Check In**, enter what your company requires (actual weight, seat, bags and bag weight, the hazmat declaration), then **Check In Passenger**. Weighed weights replace booked ones for weight and balance.",
      "Mark anyone who doesn't turn up as **No-show**, with the reason. **Promote** standby passengers into free seats, and add walk-ups with **+ Walk-up** where your company allows them.",
      "Press **Begin Boarding**, **Board** each passenger as they go, then **Close Boarding**.",
    ],
    notes: [
      "Boarding can't close while a passenger is neither checked in nor marked no-show.",
      "Which fields are required, and whether closing boarding locks the manifest, is set under Settings → Check-in.",
      "A no-show drops out of weight and balance and the passenger counts.",
    ],
    pages: ["/manifest"],
  },
  {
    slug: "complete-the-flight-log",
    title: "Complete the flight log",
    roles: ["pilot"],
    summary: "File the electronic flight log once the flight is down.",
    steps: [
      "After the flight, open it from **My Flights** on [Flight Crew](/flight-crew), or from the [Electronic flight log](/flight-crew/elog).",
      "Enter the out, off, on and in times. The hours are worked out from them, so a mistyped time shows up as an odd duration.",
      "Record the legs flown, including any that weren't on the release, and check the flight type on the first tab.",
      "Submit. The hours go onto the aircraft and your record, and a Chief Pilot review is raised when the log needs one.",
    ],
    pages: ["/flight-crew", "/flight-crew/elog"],
  },
  {
    slug: "pull-back-or-cancel-a-flight",
    title: "Pull back or cancel a flight",
    roles: ["dispatcher", "exec_admin"],
    summary: "Change, take back or call off a flight.",
    steps: [
      "Open the flight's packet on [Dispatch](/dispatch).",
      "Before it is released: **Edit** changes the route, stops and times, and **Cancel Flight** calls it off, with an optional reason.",
      "After it is released, before it departs: **Pull back release** returns it to scheduled. Give the reason. The pilot's release and acceptance no longer count, and the flight has to be released again.",
      "Or cancel the released flight, giving the reason.",
    ],
    notes: [
      "A cancelled flight stays on record as cancelled: nothing is deleted.",
      "A flight that has departed can't be pulled back.",
    ],
    pages: ["/dispatch"],
  },
  {
    slug: "raise-and-send-invoices",
    title: "Raise and send invoices",
    roles: ["exec_admin", "director_of_operations"],
    summary: "Check the invoices a flight raised, send them and record payment.",
    steps: [
      "When a flight lands, draft invoices are raised for its bookings. Open [Invoicing](/invoicing) to see them.",
      "Check each draft's lines against the flight, then **Mark as sent** when you have sent it. Marking it sent records that you sent it: nothing is emailed from here.",
      "When a payment arrives, open the invoice and **Record payment**.",
      "A flown flight with no invoices? Press **Raise invoices** and pick the flight.",
    ],
    notes: [
      "No invoices are raised when your company invoices in another system: Settings → Company → Invoicing.",
      "[Accounting](/accounting) shows what has been invoiced and paid, and what is owed.",
    ],
    pages: ["/invoicing", "/accounting"],
  },
];
