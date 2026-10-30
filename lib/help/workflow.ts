/**
 * One trip from booking to invoice, on one page (#114).
 *
 * The client asked for "a one-page overview of the full workflow from
 * booking to invoice, so a new user can see how everything connects".
 * Each stage names who does it, where, and what it hands to the next,
 * because the question a new user actually has is "what happens to my
 * work after I press save".
 *
 * Shown at the top of /help, and part of what the help assistant
 * answers from (corpus.ts). Text may carry Markdown links to pages.
 */

export interface WorkflowStage {
  /** The anchor on /help: /help#workflow-<slug>. */
  slug: string;
  title: string;
  /** Who does it, in words. */
  who: string;
  /** The page it happens on, and its name as the app shows it. */
  page: string;
  pageLabel: string;
  /** What happens, and what it hands on. */
  what: string;
}

export const WORKFLOW: WorkflowStage[] = [
  {
    slug: "booking",
    title: "Booking",
    who: "Reservations agents",
    page: "/reservations",
    pageLabel: "Reservations",
    what:
      "A passenger or a shipment is booked on a route and a date. A booking not yet on a flight waits in **Awaiting a flight** on [Dispatch](/dispatch), so dispatch can see the work that needs a flight.",
  },
  {
    slug: "build",
    title: "Building the flight",
    who: "Dispatchers",
    page: "/flight-following/new",
    pageLabel: "Open New Flight",
    what:
      "The flight is built with its route, stops, aircraft and times, from **+ New Flight** on Dispatch or [Open New Flight](/flight-following/new). Round trips are the default, and times fill in from the aircraft's cruise speed. Bookings are then put on it.",
  },
  {
    slug: "crew",
    title: "Crewing",
    who: "Dispatchers",
    page: "/dispatch",
    pageLabel: "Dispatch",
    what:
      "On the flight's dispatch packet, dispatch picks the PIC, and the SIC when needed, in **Flight Details**. Each pilot shows their standing for that seat on that aircraft, so a pilot who can't legally fly it is visible before the release.",
  },
  {
    slug: "load",
    title: "Manifest and loads",
    who: "Ground ops, reservations and dispatch",
    page: "/manifest",
    pageLabel: "Manifest",
    what:
      "The [Manifest](/manifest) lists who and what is on board: passengers, mail and cargo with their weights. It shows the weight left and loads waiting mail and freight to fill it. Weight and balance reads it.",
  },
  {
    slug: "release",
    title: "Weather, risk and release",
    who: "Dispatchers",
    page: "/dispatch",
    pageLabel: "Dispatch",
    what:
      "Dispatch works the packet: Weather & ATIS, NOTAMs for every stop, maintenance and airworthiness, and the risk assessment. **Generate PDF**, then **Release & generate**, releases the flight and keeps the packet as it was released. The release is refused while any check fails, and says why.",
  },
  {
    slug: "preflight",
    title: "The pilot's preflight",
    who: "Pilots",
    page: "/flight-crew",
    pageLabel: "Flight Crew",
    what:
      "Before the release the pilot files the flight's FRAT and signs it, and a dispatcher signs it too; then the pilot is on duty (**DUTY IN** on [Flight Crew](/flight-crew)) and works the preflight in order: the dispatch release, weight and balance, weather and NOTAMs, the signed FRAT, duty, then accepting the flight. Squawks found at the aircraft are filed from the same page.",
  },
  {
    slug: "board",
    title: "Gate check-in and boarding",
    who: "Ground ops and reservations agents",
    page: "/manifest",
    pageLabel: "Manifest",
    what:
      "From the manifest's **Gate Check-in**, passengers are checked in with their weighed weights, no-shows are marked, standby passengers are promoted, and boarding is opened and closed. Weighed weights replace booked ones for weight and balance.",
  },
  {
    slug: "fly",
    title: "Departure and flight following",
    who: "Dispatchers",
    page: "/flight-following",
    pageLabel: "Flight Following",
    what:
      "[Flight Following](/flight-following) shows every flight today, with its positions, and flags one that has gone quiet past the company's overdue time. Checking a flight in on arrival completes it and records its actual times.",
  },
  {
    slug: "log",
    title: "The flight log",
    who: "Pilots",
    page: "/flight-crew/elog",
    pageLabel: "Electronic flight log",
    what:
      "After the flight the pilot files the [Electronic flight log](/flight-crew/elog): the out, off, on and in times and the legs flown. Filing it puts the hours on the aircraft and in the pilot's record, and raises a Chief Pilot review when needed.",
  },
  {
    slug: "invoice",
    title: "Invoicing",
    who: "Exec Admins and Directors of Operations",
    page: "/invoicing",
    pageLabel: "Invoicing",
    what:
      "When a flight lands, draft invoices are raised for its bookings, unless the company invoices in another system (Settings → Company → Invoicing). [Invoicing](/invoicing) is where they are checked, marked as sent and paid; [Accounting](/accounting) shows what is owed.",
  },
];
