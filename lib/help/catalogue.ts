import type { Role } from "@/lib/roles";

/**
 * In-app help, keyed by the route it explains.
 *
 * Legacy's equivalent is `modules/help/features.py` — fifty entries with
 * slug, portal, title, what_it_does, who_can_use, how_to_use,
 * what_it_connects_to, real_world_example and related. The shape is
 * good and is kept. The content is not portable: it describes legacy's
 * product, and ours has diverged enough that lifting it would ship
 * documentation about features we do not have while omitting the ones
 * we do.
 *
 * SO THESE ARE WRITTEN, NOT PORTED, AND THE UNWRITTEN ONES SAY SO
 *
 * Seeded for the surfaces that exist today. A route with no entry gets
 * an honest panel naming the route and what the app does know about it
 * from the module registry, rather than a blank tab or a generic
 * paragraph that reads like help and contains nothing.
 *
 * WHO CAN USE THIS IS NOT WRITTEN DOWN HERE
 *
 * Legacy's `who_can_use` is a hand-maintained list of role slugs inside
 * the article, which is a second copy of the access rule and drifts
 * from the first. The panel reads the module registry instead — the
 * gate the app actually enforces — so an article cannot tell a pilot
 * they may use something the nav hides from them.
 */

export interface HelpEntry {
  /** Route this explains. Matched longest-prefix, so a parent entry
   *  covers its children until one of them has its own. */
  route: string;
  title: string;
  /** One paragraph. What the page is for, in the operator's terms. */
  whatItDoes: string;
  /** Ordered steps, written as actions rather than descriptions. */
  howToUse: string[];
  /** What else in the app this reads from or feeds into — the thing
   *  people actually ask about, which is "where did that number come
   *  from". */
  connectsTo?: string;
  /** What is deliberately absent or deliberately unusual. This section
   *  exists because most questions about this product are "why does it
   *  not do X", and the answer is usually a decision rather than a
   *  gap. */
  worthKnowing?: string[];
  /** Other routes a reader of this one usually wants next. */
  related?: string[];
  /**
   * Roles this page is for. Typed against the role vocabulary, so an
   * article cannot advertise itself to a role that does not exist —
   * legacy stored these as free strings and scoped articles to
   * `director_ops` and `dom`, neither of which is a role here.
   *
   * Descriptive, not a gate: the page's own server-side check decides
   * access. This tells a reader whether an article is written for them.
   */
  whoCanUse?: Role[];
  /**
   * One concrete situation, named stations and all. Legacy carries one
   * per article and they are the most useful part — an operator
   * recognises their own Tuesday in them faster than they parse a
   * feature description.
   */
  example?: string;
  /**
   * Deep-dive sections for the articles that need more than a
   * paragraph: how a scoring band is built, what each MEL category
   * means, a tab-by-tab walkthrough. Legacy calls these `extras`.
   */
  sections?: HelpSection[];
}

export interface HelpSection {
  heading: string;
  body?: string;
  steps?: string[];
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    route: "/home",
    title: "Home",
    whatItDoes:
      "Your launch pad. Every department you have access to is a tile here, and the alerts panel shows what needs attention right now across the whole operation.",
    howToUse: [
      "Read the three counters at the top — airborne, on ground, and aircraft on hold.",
      "Work down Active Alerts: red first, then amber.",
      "Click any department tile to enter it, or use the search box in the top bar to jump straight to a page.",
    ],
    connectsTo:
      "The alerts are derived live from fleet airworthiness, the flight board and open MEL items. Nothing here is stored, so an alert disappears the moment its cause does — return a grounded aircraft to service and it leaves the list on the next load.",
    worthKnowing: [
      "This panel is unfiltered. The bell in the top bar shows the same alerts minus the ones you personally dismissed, so the two can legitimately show different counts.",
      "The caption says how many alert types are wired. The rest need services that are not built, and it names that rather than implying the list is everything.",
    ],
    related: ["/dispatch", "/flight-following", "/maintenance"],
  },
  {
    route: "/dispatch",
    title: "Dispatch",
    whatItDoes:
      "Where a flight is worked up and released. The packet gathers weather, weight and balance, the crew, the aircraft's airworthiness and the risk assessment into one screen, and the release is the act of saying it can go.",
    howToUse: [
      "Pick a flight from the board, or build one with + New Flight if it does not exist yet.",
      "Work down the packet. Anything that blocks a release is called out as a hard block with the reason.",
      "Generate the release PDF when the packet is clear.",
    ],
    connectsTo:
      "Reads the manifest for weight and balance, the maintenance file for airworthiness, crew records for currency, and the weather service for the briefing. A release writes to the flight record and is what the flight board reads to show a flight as released.",
    worthKnowing: [
      "Building a flight is reachable from here as well as from Flight Following. It was only on Flight Following until an operator reported being unable to find it.",
      "The AI Assistant and AI Review buttons on the packet are not built. Dispatch Intelligence, which suggests aircraft for a next leg, is a separate page.",
    ],
    related: ["/dispatch/intelligence", "/flight-following", "/weather"],
  },
  {
    route: "/dispatch/intelligence",
    title: "Dispatch Intelligence",
    whatItDoes:
      "Suggests which aircraft could fly a next leg, ranked, with the reason for each. Aircraft that cannot legally be flown are shown with the reason and carry no rank at all.",
    howToUse: [
      "Open it with an airborne aircraft in the operation; the page lists the feasible options.",
      "Read each option's reason before its rank. The rank comes from a documented precedence, not a score.",
      "Anything shown as blocked names what blocks it — grounded, MEL overdue, hundred-hour overdue, annual overdue.",
    ],
    connectsTo:
      "Reads the flight board for what is airborne, the fleet's airworthiness for what can legally fly, and the shared cost model for the cost of an hour.",
    worthKnowing: [
      "There is no 0-100 score, deliberately. Legacy scored options on a single scale that priced legal bars in the same currency as revenue, so with enough passengers booked an aircraft that could not legally fly outranked one that could.",
      "There is no approve button yet. Creating the flight from an option writes, and that deserves its own change rather than being bolted onto a read-only board.",
    ],
    related: ["/dispatch", "/maintenance"],
  },
  {
    route: "/flight-following",
    title: "Flight Following",
    whatItDoes:
      "The live board. Every flight today with its status, its aircraft, and whether it has gone quiet for longer than your operator's overdue threshold.",
    howToUse: [
      "Scan for overdue flights — they are flagged, and they are also what the alerts panel and the notification bell pick up.",
      "Open a flight to see its positions and check in its departure or arrival.",
      "Arrival check-in is what moves a flight to completed and records its actual times.",
    ],
    connectsTo:
      "Overdue is computed from the scheduled arrival plus the threshold on Settings then Flight Tracking. Actual times recorded here are what every block-hour, cost and margin figure in Reports is built from.",
    worthKnowing: [
      "A flight with no actual times recorded contributes no hours anywhere. Reports name those rather than treating them as zero.",
    ],
    related: ["/dispatch", "/settings/flight-tracking", "/reports"],
  },
  {
    route: "/maintenance",
    title: "Maintenance",
    whatItDoes:
      "The fleet's airworthiness picture: what is grounded, what is deferred under the MEL, what is coming due, and the work orders against it.",
    howToUse: [
      "The fleet list shows each aircraft's blocking and advisory counts.",
      "Squawks are reported defects; MEL items are deferrals with a due date; work orders are the work itself.",
      "Due List — the Maintenance Clock — is where hours and calendar milestones count down.",
    ],
    connectsTo:
      "Grounding an aircraft removes it from dispatch immediately and raises an alert on the home page and the bell. Airframe and engine hours come from crew flight logs.",
    worthKnowing: [
      "Grounded means a grounding timestamp is set, which the auto-grounding job does when a MEL expires. That is a different test from whether the aircraft is marked active.",
      "Inspections, Vendors, Roster and adding an aircraft are not built, and are dimmed on the header rather than hidden.",
    ],
    related: ["/maintenance/mx-clock", "/maintenance/work-orders", "/dispatch"],
  },
  {
    route: "/reports",
    title: "Reports",
    whatItDoes:
      "Three groups: executive analytics read on screen, the five regulatory returns that leave the building as filings, and the schedule export.",
    howToUse: [
      "Executive reports default to the month just gone, not the one in progress — a partial month reads like a total.",
      "Each regulatory return answers on screen and as a CSV built from the same figures, so the filed file and the reviewed table cannot disagree.",
      "The CSV filename carries its period, because these get saved and found again a year later.",
    ],
    connectsTo:
      "Costs come from one shared cost model, so the same hour of flying costs the same on every page. Revenue comes from bookings and invoices; mail and cargo from locked manifests only.",
    worthKnowing: [
      "A figure that cannot be measured renders as a dash, never a zero. No cost on file is not the same as free, and no manifest is not the same as an empty aircraft.",
      "Every report says what it could not measure, and how many records that was.",
    ],
    related: ["/reports/bi", "/profitability", "/reports/regulatory"],
  },
  {
    route: "/reports/bi",
    title: "Business Intelligence",
    whatItDoes:
      "Four commercial metrics over a fixed trailing twelve months: seasonal demand, load factor by route, revenue per block hour by aircraft type, and your top customers by revenue.",
    howToUse: [
      "There is no month picker. Seasonal demand over one month is not a pattern, so the window is always the last twelve complete months and the page says so.",
      "Read the manifested count beside every load factor — that is the population the figure was measured over.",
      "Route margin is on the Profitability report rather than repeated here.",
    ],
    connectsTo:
      "Load factor counts only flights that locked a manifest. Revenue per hour uses the shared cost model and the same block hours the executive summary reports.",
    worthKnowing: [
      "A route with no manifested flights has no load factor, shown as a dash. Legacy reports that case as 0%, which reads as flying empty rather than as not having counted.",
    ],
    related: ["/profitability", "/reports/executive/summary"],
  },
  {
    route: "/profitability",
    title: "Profitability",
    whatItDoes:
      "Revenue against cost by route and by aircraft, with the margin, and with the gaps in each row named.",
    howToUse: [
      "Pick a month with the period control.",
      "Read the uncosted and untimed counts on a row before its margin — a route showing no cost is uncosted, not free.",
      "Zero revenue against real cost is a loss, not a 0% margin, and shows as a dash.",
    ],
    connectsTo:
      "Cost comes from your own operating-cost factors under Settings then Costs. An aircraft with no factors on file contributes no cost, and the row says so.",
    worthKnowing: [
      "Legacy's equivalent has no revenue column at all, and substitutes invented per-type fuel burn and fuel prices when an operator has configured nothing. Ours counts the gap instead.",
    ],
    related: ["/reports/bi", "/settings/costs", "/accounting"],
  },
  {
    route: "/reports/regulatory",
    title: "Regulatory returns",
    whatItDoes:
      "The five filings: T-100 mail traffic, PS Form 5500 mail trips, CAM route performance, USPS Form 5394 per-flight mail records, and DOT Form 41 quarterly operating statistics.",
    howToUse: [
      "Four are monthly and one — Form 41 — is quarterly, which is why it takes a different period control.",
      "Review the table, then export the CSV. Both come from the same computation.",
      "The draft-manifest warning tells you the figures are provisional because cargo on an unlocked manifest is not counted.",
    ],
    connectsTo:
      "Mail figures come from locked manifests where a mail class is set. A blank mail class is general cargo, not mail.",
    worthKnowing: [
      "Cancelled flights carry nothing. A manifest can be locked and the flight then cancelled, and counting it would report weight that never moved.",
      "A completion rate with nothing scheduled shows as a dash rather than 0%.",
    ],
    related: ["/reports", "/reports/sim"],
  },
  {
    route: "/reports/sim",
    title: "Schedule Export",
    whatItDoes:
      "Schedule data for OAG or an accounting system, as CSV, fixed-width SIM or XML. Two kinds of record: one per recurring service, or one per departure with actuals.",
    howToUse: [
      "Set the window and pick which records you want — schedule or flights.",
      "The page previews exactly what the file will contain before you download it.",
      "Fixed-width is schedule-only: the record layout ends at seats and has no passenger, cargo or mail columns.",
    ],
    connectsTo:
      "Filed under your carrier code, which is set on Settings then Company Profile. Without one the export refuses to run rather than guessing, because whatever receives the file keys on that code to decide whose flights these are.",
    worthKnowing: [
      "A schedule record is not a flight. Three Tuesdays of one weekly service are one record with its operating days, not three records each claiming a weekly pattern.",
      "A service backed by a single departure is marked, because its weekly pattern is an inference from one flight.",
    ],
    related: ["/settings/company", "/reports/regulatory"],
  },
  {
    route: "/compliance/data-integrity",
    title: "Data Integrity Review",
    whatItDoes:
      "The 30-day review your General Operations Manual requires, with the discrepancies to review and a record of who signed it.",
    howToUse: [
      "Read the contradictions first — records that disagree with each other, so at least one is wrong.",
      "Then the omissions — something required that is absent.",
      "Write what you reviewed and what you did about it, and record the review. The Director of Operations signs; a chief pilot, DOM or safety officer can read it.",
    ],
    connectsTo:
      "The checks read flights, manifests, aircraft, bookings, risk assessments and crew logs. The implausible-block-time check uses the same threshold the cost model uses, so a leg invisible to one is visible to the other.",
    worthKnowing: [
      "Signing records the review. It does not clear the findings — the obligation is periodic review, not an absence of discrepancies.",
      "Contradictions are counted over all history, omissions over the 30-day window. A wrong record does not stop being wrong as it ages; nobody can retroactively file a risk assessment for a flight last June.",
    ],
    related: ["/compliance/records-request", "/reports"],
  },
  {
    route: "/compliance/records-request",
    title: "Records Request",
    whatItDoes:
      "Produces the records an authorised requestor — the FAA, the NTSB — is entitled to, within the 48 hours your manual commits to, and records the disclosure.",
    howToUse: [
      "Enter who asked, their reference, and when their written request arrived. That last one is what the 48 hours is measured from.",
      "Pick only the record sets they asked for. Selecting nothing produces nothing; it is not a shorthand for everything.",
      "Producing the bundle writes the disclosure record. There is no way to do one without the other.",
    ],
    connectsTo:
      "The archive carries a cover sheet naming the requestor, the scope, a row count and a checksum for every file — and the categories that are not included, with the reason for each.",
    worthKnowing: [
      "A bundle is never truncated. A scope too large to produce is refused, because a file that looks complete and is not is worse than one that was declined.",
      "A registration we cannot find is refused rather than widened to the whole fleet.",
      "Airman records, drug and alcohol testing, training files and airframe logbooks are not produced here. Each bundle says so.",
    ],
    related: ["/compliance/data-integrity"],
  },
  {
    route: "/settings/frat",
    title: "Flight Risk Thresholds",
    whatItDoes:
      "Where Low, Medium, High and Extreme begin on the pre-flight risk assessment, for your operation.",
    howToUse: [
      "The bar redraws as you type, so you can see what moving a threshold does before saving.",
      "Each band must start above the one before it, and Extreme cannot start above the highest total the questionnaire can produce.",
      "Saving records who set them and when, even if you keep the values unchanged.",
    ],
    connectsTo:
      "High routes a flight through dispatch via the release packet. Extreme cannot depart without a Chief Pilot or Director of Operations authorisation recorded against it. The questionnaire itself is step 4 of a pilot's preflight, which is reached per flight rather than as a page of its own.",
    worthKnowing: [
      "No FAR sets these numbers — Part 135 does not require a flight risk assessment tool at all — so they belong to whoever signs your manual. What ships is a starting point, not guidance.",
      "Changing a threshold changes the band new assessments land in. Assessments already submitted keep the band they were scored under.",
    ],
    related: ["/dispatch", "/settings"],
  },
  {
    route: "/settings",
    title: "Settings",
    whatItDoes:
      "Company configuration: your identity and carrier code, bases, users and permissions, operating costs, pay, currency, tracking thresholds and flight risk bands.",
    howToUse: [
      "Company Profile holds your legal name, Part 135 certificate and carrier code.",
      "Costs is what every margin figure in Reports is computed from — an aircraft type with no factors contributes no cost.",
      "Users and Permissions is where roles are granted, and roles decide what each person can see.",
    ],
    connectsTo:
      "Almost every figure in Reports traces back to something here. The carrier code gates the schedule export; the cost factors gate every margin; the overdue threshold gates the alerts.",
    worthKnowing: [
      "Reading these pages is open to everyone, because the app needs your branding on every page. Changing them is limited to the executive admin and the Director of Operations.",
    ],
    related: ["/settings/company", "/settings/costs", "/settings/users"],
  },
  // ── Reservations ────────────────────────────────────────────────────
  {
    route: "/reservations",
    title: "Reservations",
    whoCanUse: ["reservations_agent", "dispatcher", "exec_admin"],
    whatItDoes:
      "Where a trip starts. Search for availability, build a booking, and hand the result to Dispatch as a flight. The hub page is the booking search itself — trip type, route, passengers and dates — because that is the first thing an agent does when the phone rings.",
    howToUse: [
      "Pick the trip type: one way, return, or freight.",
      "Enter the route and the date, and the passenger or cargo load.",
      "Search, then choose from the flights offered.",
      "Fill in the customer, and confirm to create the booking.",
      "Open the Fleet Board to see where the booking sits against the rest of the day.",
    ],
    connectsTo:
      "A confirmed booking becomes a flight that Dispatch sees on the Flight Following board. Passenger and cargo weights flow into the dispatch packet's weight and balance. Completed flights feed the accounting export and the profitability report.",
    example:
      "A caller wants two seats PANC to PABE on Thursday and a return on Saturday. The agent searches return, picks the 08:15 out and the 16:40 back, attaches the customer, and confirms. Dispatch sees both legs on the board without anyone re-typing them.",
    related: ["/reservations/fleet-board", "/reservations/charter", "/flight-following"],
  },
  {
    route: "/reservations/fleet-board",
    title: "Fleet Board",
    whoCanUse: ["reservations_agent", "dispatcher", "chief_pilot", "exec_admin"],
    whatItDoes:
      "The day's flying laid out by aircraft, so an agent can see what is already committed before promising anything. Each aircraft is a row and each flight a block on it, which makes a gap in the schedule — or a double-booking — visible at a glance rather than something you work out from a list.",
    howToUse: [
      "Pick the date you are selling against.",
      "Read down the aircraft rows to find an airframe with room.",
      "Click a block to open the flight it belongs to.",
      "Use the list view instead when you want to sort or scan by time rather than by aircraft.",
    ],
    connectsTo:
      "Blocks come from confirmed bookings and from flights created in Dispatch, so the board shows both sides of the operation. Aircraft rows come from the fleet in Settings.",
    example:
      "An agent is asked for a same-day charter to PADU. The board shows the 208B free after 14:00 and the Navajo committed all afternoon, so they quote the 208B and avoid a conflict that a list view would have buried.",
    worthKnowing: [
      "Legacy offers a split-screen drag-and-drop that moves a booking between aircraft by dragging. Ours does not: moving a flight between airframes changes its weight and balance and can invalidate a release, so it is done on the flight rather than by dropping a block.",
    ],
    related: ["/reservations", "/schedule", "/flight-following"],
  },
  {
    route: "/reservations/charter",
    title: "Charter quoting",
    whoCanUse: ["reservations_agent", "exec_admin"],
    whatItDoes:
      "Builds a price for a charter from the legs, the aircraft and the rates the operator has configured, so two agents quoting the same trip arrive at the same number.",
    howToUse: [
      "Add each leg of the trip, in order.",
      "Choose the aircraft the quote is priced against.",
      "Check the computed hours against what you expect — the rate is applied per hour, so an optimistic leg time understates the quote.",
      "Add any fixed charges the trip carries.",
      "Save the quote, and convert it to a booking once the customer accepts.",
    ],
    connectsTo:
      "Rates come from Settings → Costs. An accepted quote becomes a booking, and the booking becomes a flight on the Flight Following board.",
    example:
      "A lodge asks for PANC–PAKN–PANC with a four-hour wait. The agent enters both legs, prices against the 208B, and the quote returns the round trip plus the wait time rather than two one-way fares added together.",
    related: ["/reservations", "/settings/costs", "/profitability"],
  },
  {
    route: "/reservations/rewards",
    title: "Rewards programme",
    whoCanUse: ["reservations_agent", "exec_admin"],
    whatItDoes:
      "The operator's frequent-flyer scheme: members, their balances, and what they have earned. The programme's name is set per operator in Settings, so this page shows whatever the operator calls theirs rather than a fixed brand.",
    howToUse: [
      "Search for a member by name to see their balance and history.",
      "Enrol a customer from their customer record.",
      "Read the active-member count in the header as the programme's size.",
    ],
    connectsTo:
      "Members are customers, so enrolment and contact details live on the customer record. Earning is driven by completed bookings.",
    related: ["/customers", "/reservations"],
  },
  // ── Flight crew ─────────────────────────────────────────────────────
  {
    route: "/flight-crew",
    title: "Flight Crew",
    whoCanUse: ["pilot", "check_airman", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "A pilot's own corner of the app: the flights assigned to them, the preflight they have to work through before a release, their logbook, and their currency. Everything here is about one person rather than the operation.",
    howToUse: [
      "Open the flight you are about to operate to start its preflight.",
      "Work the preflight steps in order — the release is the last one, and it stays closed until the earlier steps are answered.",
      "File the electronic flight log after the flight, while the numbers are still in front of you.",
      "Check your currency before accepting a flight that needs a qualification you are close to losing.",
    ],
    sections: [
      {
        heading: "The preflight steps",
        body: "The flow is deliberately linear. Each step writes something the next one reads, so skipping ahead would mean signing a release against numbers nobody had entered yet.",
        steps: [
          "Dispatch release — the packet the dispatcher built, for the pilot to accept or reject.",
          "Weight and balance — loaded from the manifest, with the envelope checked against the airframe.",
          "Weather and NOTAMs — what was current when the release was signed, kept with the flight.",
          "Risk assessment — the FRAT, scored against the operator's own thresholds.",
          "Acceptance — the pilot's name against the release, which is the record that matters afterwards.",
        ],
      },
    ],
    connectsTo:
      "The preflight reads the dispatch packet and the manifest, and writes the acceptance back to the flight. A filed flight log pushes hours to Maintenance and pay events to Payroll. Currency comes from the compliance records, not from the logbook.",
    example:
      "A first officer opens their 06:40 to PABE, finds the release waiting, accepts it, and the flight moves to released on the dispatcher's board without a phone call.",
    related: ["/flight-crew/elog", "/compliance/crew-currency", "/dispatch"],
  },
  {
    route: "/flight-crew/elog",
    title: "Electronic flight log",
    whoCanUse: ["pilot", "check_airman", "chief_pilot", "exec_admin"],
    whatItDoes:
      "The logbook entry for a flight: out, off, on, in, the hours that fall out of them, and the legs flown. Filing it is what turns a completed flight into hours on an airframe, time in a pilot's record, and a pay event.",
    howToUse: [
      "Open the flight you have just finished.",
      "Enter the four times. The hours are computed from them rather than typed, so a transposed digit shows up as an implausible duration.",
      "Record the legs, including any that were not on the original release.",
      "Submit. A chief pilot review is raised if the entry needs one.",
    ],
    sections: [
      {
        heading: "Why the times and not the hours",
        body: "Block and flight time are derived from out/off/on/in. Entering hours directly would let a log say 2.0 block against times that span three hours, and the disagreement would never surface. Deriving them means the times are the record and the hours are a reading of it.",
      },
      {
        heading: "What happens after you submit",
        steps: [
          "Airframe hours advance, which moves the maintenance clock.",
          "A pay event is created if the flight earns one.",
          "The entry joins your flight history, which is what a currency check reads.",
          "A chief pilot review is queued where the operator requires one.",
        ],
      },
    ],
    connectsTo:
      "Hours flow to Maintenance's time clock and to Payroll. Reviews appear in the chief pilot's review queue. The entry itself is part of the 135.63 record.",
    example:
      "A pilot lands at PAKN, enters 14:02 / 14:19 / 15:38 / 15:47, and the log returns 1:45 block and 1:19 flight. The airframe's next inspection moves by 1:45 without anyone updating it by hand.",
    related: ["/flight-crew/history", "/flight-crew/elog/cp-reviews", "/maintenance/mx-clock"],
  },
  {
    route: "/flight-crew/history",
    title: "Flight history",
    whoCanUse: ["pilot", "check_airman", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Every flight a pilot has logged, with the times and the legs, as an auditable list. It is the answer to \"show me what this pilot has actually flown\", which is what an inspector asks and what a currency dispute turns on.",
    howToUse: [
      "Filter to the period you are being asked about.",
      "Open an entry to see the times as filed and anything amended since.",
      "Read the totals as the aeronautical experience for that window.",
    ],
    connectsTo:
      "Built from filed flight logs. Feeds the currency calculation and the 135.63 consolidated experience figures on the airman record.",
    related: ["/flight-crew/elog", "/compliance/crew-currency"],
  },
  {
    route: "/flight-crew/elog/cp-reviews",
    title: "Chief pilot reviews",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The queue of flight logs waiting on a chief pilot's look. A review is a second pair of eyes on an entry, not a gate on the flight — the flight already happened.",
    howToUse: [
      "Work the queue oldest first; an unreviewed log is an open item in the record.",
      "Open an entry to see the filed times and the pilot's notes.",
      "Accept it, or send it back with what needs correcting.",
    ],
    connectsTo:
      "Entries come from filed flight logs. A returned entry goes back to the pilot's log for amendment, and the amendment is kept alongside the original rather than replacing it.",
    related: ["/flight-crew/elog", "/dashboards/chief-pilot"],
  },
  // ── Compliance and records ──────────────────────────────────────────
  {
    route: "/compliance/crew-currency",
    title: "Crew currency",
    whoCanUse: ["chief_pilot", "check_airman", "director_of_operations", "safety_officer", "exec_admin"],
    whatItDoes:
      "Who is current for what, and what is about to lapse. The matrix is pilots against the currency items the operator tracks, coloured by how close each one is to expiry, so the question \"can this pilot take this flight tomorrow\" has a one-look answer.",
    howToUse: [
      "Scan for red first — those are lapsed, not close to it.",
      "Open a pilot to see each item with the event that satisfied it and when it runs out.",
      "Log a completion against an item when training or a check has been done.",
    ],
    sections: [
      {
        heading: "Why a rolling window, and what it means for a green cell",
        body: "Recency requirements are measured backwards from today, not from a fixed calendar point. A pilot who did three takeoffs and landings on 2 July is current on 30 September and not current on 2 October, with nothing having happened in between. That is why this page is worth reading the day before a flight rather than the month before.",
      },
      {
        heading: "What the colours mean",
        steps: [
          "Green — satisfied, with room in the window.",
          "Yellow — satisfied, but inside the warning period the operator set.",
          "Red — lapsed. The pilot is not current for that item today.",
          "Grey — not tracked for this pilot, which is different from satisfied.",
        ],
      },
    ],
    connectsTo:
      "Completions come from logged training and check events, and from filed flight logs where the requirement is recency of flying. The roster page reads the same data by base and airframe.",
    example:
      "A chief pilot looking at Thursday sees one pilot's line check turning yellow on Wednesday. They schedule the check on Tuesday, rather than discovering it red on Thursday morning with a flight to cover.",
    related: ["/compliance/roster", "/flight-crew/history", "/dashboards/chief-pilot"],
  },
  {
    route: "/compliance/roster",
    title: "Pilot roster",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The crew the operator has, by base and by what each is qualified to fly. It answers staffing questions — who could cover PABE next week — rather than currency questions, which the currency matrix answers.",
    howToUse: [
      "Filter to a base to see who is assigned there.",
      "Read across to see qualifications by airframe and duty position.",
      "Open a pilot for their full compliance profile.",
    ],
    connectsTo:
      "Qualifications and currency come from the same records the currency matrix reads. Bases come from Settings.",
    related: ["/compliance/crew-currency", "/settings/bases"],
  },
  // ── Maintenance ─────────────────────────────────────────────────────
  {
    route: "/maintenance/squawks",
    title: "Squawks",
    whoCanUse: ["maintenance", "director_of_maintenance", "pilot", "chief_pilot", "exec_admin"],
    whatItDoes:
      "Defects reported against an airframe, from the person who found them. A squawk is the raw report; what happens to it is a work order, and the two are kept separate so a pilot can report something without deciding how it gets fixed.",
    howToUse: [
      "Raise a squawk against the aircraft and describe what was observed, not what you think it is.",
      "Say whether the aircraft is airworthy as it stands — that is the decision that matters immediately.",
      "Maintenance triages it and raises a work order where one is needed.",
      "Follow the squawk through to the work order that closes it.",
    ],
    sections: [
      {
        heading: "Squawk, work order, MEL — which is which",
        steps: [
          "A squawk is a report: somebody saw something.",
          "A work order is the work: what will be done about it, by whom, and when.",
          "An MEL entry is a decision to fly with it, under a published limitation and for a bounded time.",
        ],
      },
    ],
    connectsTo:
      "A triaged squawk raises a work order. Grounding decisions surface on the maintenance dashboard and on the dispatcher's board, because a grounded airframe changes what can be released.",
    example:
      "A pilot reports the left landing light out at PAKN. Maintenance triages it, decides it is deferrable under the MEL for day operations, and raises a work order dated for the next scheduled visit. Dispatch sees the limitation rather than a grounded aircraft.",
    related: ["/maintenance/work-orders", "/maintenance/mel", "/maintenance"],
  },
  {
    route: "/maintenance/work-orders",
    title: "Work orders",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "The work itself: what is being done to which airframe, what parts it consumes, and who signed it off. A work order is the paperwork an inspector asks for, so it is written to be read later rather than just to organise today.",
    howToUse: [
      "Open the work order for the aircraft you are working on.",
      "Record the parts used as you use them, so inventory stays true.",
      "Record the hours against the task.",
      "Sign it off when the work is complete — that signature is what releases the aircraft back to service.",
    ],
    connectsTo:
      "Raised from squawks and from scheduled inspections. Parts draw down Inventory. A signed-off order feeds the return-to-service queue.",
    related: ["/maintenance/squawks", "/maintenance/rts", "/maintenance/inventory"],
  },
  {
    route: "/maintenance/rts",
    title: "Return to service",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "The queue of aircraft with completed work that has not yet been signed back into service. An airframe sits here between the work being finished and somebody with the authority to release it saying so.",
    howToUse: [
      "Work the queue — an aircraft in it is an aircraft Dispatch cannot release.",
      "Check the completed work and the parts recorded against it.",
      "Sign the return to service. Your name and the time are the record.",
    ],
    connectsTo:
      "Fed by signed-off work orders. A release here makes the airframe available to Dispatch again, so the queue is the bottleneck between maintenance finishing and flying resuming.",
    example:
      "The 208B's 100-hour finishes at 16:00. It sits in the RTS queue until the DOM signs it at 16:20, and only then does it reappear as available on the following morning's board.",
    related: ["/maintenance/work-orders", "/maintenance/availability"],
  },
  {
    route: "/maintenance/mel",
    title: "MEL",
    whoCanUse: ["maintenance", "director_of_maintenance", "chief_pilot", "director_of_operations", "dispatcher", "exec_admin"],
    whatItDoes:
      "The minimum equipment list, and what is currently deferred against it. An MEL entry is a decision to operate with something inoperative, under a published limitation and for a bounded period — so this page is as much about the clock on a deferral as about the deferral itself.",
    howToUse: [
      "Open the aircraft to see what is deferred against it now.",
      "Read the category, which sets how long the deferral may run.",
      "Check the expiry before releasing a flight — an expired deferral is not a deferral.",
      "Clear the entry when the work is done.",
    ],
    sections: [
      {
        heading: "The categories, and why the clock differs",
        steps: [
          "Category A — the interval is specified in the MEL itself rather than by category.",
          "Category B — three consecutive calendar days.",
          "Category C — ten consecutive calendar days.",
          "Category D — one hundred and twenty consecutive calendar days.",
        ],
      },
      {
        heading: "What a deferral obliges",
        body: "A deferral usually carries an operational or a maintenance procedure, sometimes both. The limitation travels with the aircraft, which is why it appears in the dispatch packet rather than only here: the person releasing the flight has to know what they are releasing it with.",
      },
    ],
    connectsTo:
      "Deferrals surface in the dispatch packet and on the preflight, so a pilot accepting a release sees them. Clearing an entry usually closes a work order.",
    related: ["/maintenance/squawks", "/dispatch", "/maintenance/availability"],
  },
  {
    route: "/maintenance/mx-clock",
    title: "Maintenance due list",
    whoCanUse: ["maintenance", "director_of_maintenance", "chief_pilot", "exec_admin"],
    whatItDoes:
      "What is coming due on each airframe, by hours and by calendar. The clock moves on its own as flight logs are filed, which is why this is a list to read weekly rather than a plan to set once.",
    howToUse: [
      "Read the nearest due item per aircraft first.",
      "Compare hours remaining against what the aircraft is scheduled to fly this week.",
      "Schedule the visit before the margin is gone, not when it is.",
    ],
    connectsTo:
      "Hours advance from filed electronic flight logs. Due items raise work orders. Parts shelf life is tracked separately on the expiration report.",
    example:
      "The Navajo shows 12.4 hours to its next inspection and is rostered for 18 hours this week. The DOM moves the inspection to Wednesday rather than finding out on Friday.",
    related: ["/maintenance/work-orders", "/maintenance/expiration", "/flight-crew/elog"],
  },
  {
    route: "/maintenance/inventory",
    title: "Parts inventory",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "What parts are held, where, and how many. Drawn down by work orders as parts are consumed, so the count reflects what has been fitted rather than what was last counted.",
    howToUse: [
      "Search for a part to see the quantity on hand and where it is held.",
      "Receive stock when it arrives.",
      "Let work orders do the consuming — adjusting by hand here hides the reason a part left the shelf.",
    ],
    connectsTo:
      "Work orders consume stock. Shelf-life dates feed the parts expiration report.",
    related: ["/maintenance/work-orders", "/maintenance/expiration", "/maintenance/batch-trace"],
  },
  {
    route: "/maintenance/expiration",
    title: "Parts expiration",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Parts with a shelf life, and when it runs out. Separate from the maintenance due list on purpose: that one is about airframes accruing hours, this one is about stock going out of date on a shelf whether or not anything flies.",
    howToUse: [
      "Read the nearest expiry first.",
      "Check quantities before ordering — an expiring part you hold six of is a different problem from one you hold one of.",
      "Remove expired stock from inventory so it cannot be fitted.",
    ],
    connectsTo: "Reads shelf-life dates recorded against inventory.",
    related: ["/maintenance/inventory", "/maintenance/mx-clock"],
  },
  {
    route: "/maintenance/availability",
    title: "Fleet availability",
    whoCanUse: ["maintenance", "director_of_maintenance", "dispatcher", "chief_pilot", "exec_admin"],
    whatItDoes:
      "Which aircraft can fly right now, and what is stopping the ones that cannot. Dispatch reads it before promising a flight; maintenance reads it to see the effect of the work it has open.",
    howToUse: [
      "Read the unavailable aircraft first, and the reason against each.",
      "Follow a reason through to the work order or MEL entry behind it.",
    ],
    connectsTo:
      "Built from open work orders, the return-to-service queue and MEL deferrals. Feeds the dispatcher's board and the maintenance dashboard.",
    related: ["/maintenance/rts", "/maintenance/mel", "/maintenance"],
  },
  // ── Safety ──────────────────────────────────────────────────────────
  {
    route: "/safety",
    title: "Safety SMS",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The safety management system: what has been reported, what is being done about it, and whether it worked. Reporting is open to everyone in the operation; triage and corrective action are not.",
    howToUse: [
      "Read the open hazard reports first — an untriaged report is an unassessed risk.",
      "Triage a report by giving it a severity and a likelihood, which is what turns a description into a risk.",
      "Raise a corrective action where one is needed, and assign an owner.",
      "Close the loop by recording whether the action worked, not just that it was done.",
    ],
    sections: [
      {
        heading: "The four pillars, and where each one lives here",
        steps: [
          "Safety policy — the operator's published commitment and the accountable executive. Lives in the GOM, in the document library.",
          "Safety risk management — hazard reports, triaged into severity and likelihood. That is this page.",
          "Safety assurance — corrective actions, and the check afterwards that they changed something.",
          "Safety promotion — training and communication, which is where Academy and required reading come in.",
        ],
      },
      {
        heading: "Why reporting is separate from triage",
        body: "Anyone can file; a small number of people assess. Keeping those apart is the point of a reporting culture — a ramp agent should be able to report a near miss without first deciding how serious it was, and a severity set by the reporter would bias every number downstream.",
      },
    ],
    connectsTo:
      "Reports come from the floating Safety button on every page. Triaged reports feed corrective actions and the safety dashboard. Safety Intelligence reads the same reports to look for patterns across them.",
    example:
      "A ramper reports a fuel truck parked inside the wing line at PABE. The safety officer triages it as minor severity but occasional likelihood, raises a corrective action to repaint the stand markings, and closes it after a spot check two weeks later shows trucks stopping short.",
    related: ["/safety/incidents", "/safety/actions", "/ai/safety-intelligence"],
  },
  {
    route: "/safety/report",
    title: "Filing a safety report",
    whoCanUse: ["pilot", "crew_member", "maintenance", "ground_ops", "dispatcher", "reservations_agent", "safety_officer", "chief_pilot", "check_airman", "director_of_maintenance", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Reports a hazard. The red Safety button in the corner of every page opens the same form, so a report can be filed from wherever the thing was noticed rather than by navigating here first.",
    howToUse: [
      "Describe what you saw, not what you concluded — the assessment is somebody else's job.",
      "Say where and when.",
      "Say whether it is still happening, which is what decides how fast it gets looked at.",
      "Submit. You will be able to follow it under My Reports.",
    ],
    worthKnowing: [
      "You are not asked for a severity. Severity and likelihood are set at triage, by the safety officer, because a reporter's own estimate of how bad something was biases every figure computed from it afterwards.",
    ],
    connectsTo:
      "A filed report appears in the safety officer's queue and in your own My Reports list.",
    related: ["/safety/mine", "/safety"],
  },
  {
    route: "/safety/incidents",
    title: "Incidents",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Events that actually happened, as distinct from hazards that could. An incident carries the same triage and corrective-action machinery as a hazard report, plus the detail a post-event review needs.",
    howToUse: [
      "Triage the incident with a severity and a likelihood of recurrence.",
      "Record what happened in enough detail for somebody reading it in a year.",
      "Raise corrective actions against the causes, not the event.",
    ],
    connectsTo:
      "Shares the corrective-action board with hazard reports. Feeds the safety dashboard and Safety Intelligence.",
    related: ["/safety/actions", "/safety", "/safety/dashboard"],
  },
  {
    route: "/safety/actions",
    title: "Corrective actions",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The CAPA board: every corrective action in the operation, its owner, and whether it is closed. Reading the board is open to the post-holders; opening, reassigning and closing an action is the safety officer's.",
    howToUse: [
      "Read the overdue actions first.",
      "Open one to see the report it came from and what was promised.",
      "Close it with what actually changed, so the closure means something to the next person who reads it.",
    ],
    worthKnowing: [
      "Reading the board and owning the programme are deliberately different permissions. A chief pilot or Director of Operations can see everything here and triage the report behind an action, but closing one out is the Safety Officer's — that separation is what makes a closure worth anything.",
    ],
    connectsTo:
      "Actions are raised from hazard reports and incidents. Open counts feed the safety dashboard.",
    related: ["/safety", "/safety/incidents", "/safety/actions/mine"],
  },
  {
    route: "/safety/dashboard",
    title: "Safety dashboard",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The safety picture as numbers: reports filed, how they were triaged, and what is still open. Useful for a safety meeting, where the argument is usually about trend rather than any single report.",
    howToUse: [
      "Read open items against closed as the state of the programme.",
      "Follow any figure through to the reports behind it rather than quoting it on its own.",
    ],
    connectsTo: "Aggregates hazard reports, incidents and corrective actions.",
    related: ["/safety", "/safety/actions", "/ai/safety-intelligence"],
  },
  // ── Academy ─────────────────────────────────────────────────────────
  {
    route: "/academy",
    title: "Academy",
    whoCanUse: ["pilot", "crew_member", "maintenance", "ground_ops", "check_airman", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The operator's own training: courses, lessons, quizzes and the record of who has completed what. It exists so that training which a certificate depends on is held in the same system as the currency it satisfies, rather than in a spreadsheet beside it.",
    howToUse: [
      "Open My Training to see what has been assigned to you and what is outstanding.",
      "Work through a course's lessons in order; the quiz unlocks at the end.",
      "A completion is recorded against your training record when you pass.",
    ],
    connectsTo:
      "Completions write through to the compliance records, so a course that satisfies a currency item moves that item. Assignments are made by a chief pilot from the assignments page.",
    related: ["/academy/mine", "/academy/assignments", "/compliance/crew-currency"],
  },
  {
    route: "/academy/studio",
    title: "Course studio",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Where courses are built: lessons, ordering, and the quiz that closes a course. This is the authoring side of Academy, separate from taking a course.",
    howToUse: [
      "Create the course and describe what completing it means.",
      "Add lessons in the order a learner should meet them.",
      "Add the quiz, and set what counts as a pass.",
      "Publish, then assign it from the assignments page.",
    ],
    worthKnowing: [
      "Legacy supports uploading a SCORM package as a course. Ours does not: a SCORM bundle brings its own player and its own completion reporting, and a completion that satisfies a currency requirement needs to come from a source we can audit rather than from a third-party bundle's own say-so.",
    ],
    connectsTo:
      "Published courses become assignable. Completions feed training records and, where the course satisfies one, a currency item.",
    related: ["/academy/assignments", "/academy", "/academy/reports"],
  },
  {
    route: "/academy/assignments",
    title: "Training assignments",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Who has been given which course, and where they are with it. Assigning is how a published course reaches a person; without it a course sits in the catalogue and nobody takes it.",
    howToUse: [
      "Choose the course, then the people or the role it goes to.",
      "Set a due date if the training is time-bound.",
      "Track completion from the same page.",
    ],
    connectsTo: "Reads the published course catalogue; writes completions to training records.",
    related: ["/academy/studio", "/academy/reports", "/compliance/crew-currency"],
  },
  // ── Your own records ────────────────────────────────────────────────
  {
    route: "/safety/mine",
    title: "My safety reports",
    whatItDoes:
      "The reports you have filed, and what happened to them. It exists because a reporting culture depends on reporters seeing that something came of it — a report that vanishes teaches people not to file the next one.",
    howToUse: [
      "Open a report to see how it was triaged and what action came out of it.",
      "Read the closure note, which is where the change that resulted is recorded.",
    ],
    connectsTo: "Your reports, as triaged by the safety officer, and any corrective action raised from them.",
    related: ["/safety/report", "/safety"],
  },
  {
    route: "/safety/actions/mine",
    title: "My corrective actions",
    whatItDoes:
      "Corrective actions assigned to you. Being an owner means the operation is waiting on you, so this is the list to read rather than the whole board.",
    howToUse: [
      "Work the overdue ones first.",
      "Record what you actually changed when you complete one — \"done\" alone tells the next reader nothing.",
    ],
    connectsTo: "A subset of the corrective-action board, filtered to you.",
    related: ["/safety/actions", "/safety"],
  },
  {
    route: "/safety/incidents/mine",
    title: "My incident reports",
    whatItDoes:
      "Incidents you reported, with how each was triaged and what was done. Separate from My Safety Reports because an incident is something that happened rather than something that might, and the follow-up on one is usually longer and more specific.",
    howToUse: [
      "Open a report to see the severity and likelihood it was given at triage.",
      "Read any corrective action raised from it, and its owner.",
      "Check the closure note — that is where what actually changed is recorded.",
    ],
    connectsTo:
      "Your incident reports as they appear on the safety officer's board, plus any corrective action raised against them.",
    related: ["/safety/incidents", "/safety/mine"],
  },
  {
    route: "/academy/mine",
    title: "My training",
    whatItDoes:
      "The courses assigned to you, what is outstanding, and what you have completed. Where training that a currency requirement depends on is concerned, this is the list that keeps you legal to fly.",
    howToUse: [
      "Start with anything overdue — some of it holds up a currency item.",
      "Work a course's lessons in order; the quiz opens at the end.",
      "Your completion is recorded automatically when you pass.",
    ],
    connectsTo:
      "Assignments come from a chief pilot. A completion writes to your training record and moves any currency item the course satisfies.",
    related: ["/academy", "/compliance/crew-currency"],
  },
  // ── Housing ─────────────────────────────────────────────────────────
  {
    route: "/housing",
    title: "Housing",
    whoCanUse: ["exec_admin", "director_of_operations", "ground_ops"],
    whatItDoes:
      "The crew housing the operator holds: the houses, their rooms, and who is in them. For an operation with crew away from base on rotation, this is the difference between knowing you have a bed and finding out at midnight that you do not.",
    howToUse: [
      "Read the house cards for the station you are staffing.",
      "Open a house to see its rooms, their rates and what is occupied.",
      "Use the Calendar to see occupancy across dates rather than just today.",
      "Use Reports for occupancy and cost over a period.",
    ],
    connectsTo:
      "Bookings are per room and per employee. Room rates feed the housing cost report. Occupancy is computed from bookings, not from the room's own status field.",
    example:
      "A rotation puts four crew into Dutch Harbor on Thursday. The coordinator checks the calendar, sees Dorm B has two rooms free and the Bunkhouse two, and books across both rather than discovering the shortfall on the day.",
    related: ["/housing/calendar", "/housing/reports"],
  },
  {
    route: "/housing/calendar",
    title: "Housing calendar",
    whoCanUse: ["exec_admin", "director_of_operations", "ground_ops"],
    whatItDoes:
      "Rooms against dates, with each booking a bar across the days it covers. It answers the question the card view cannot — not \"is this room free now\" but \"is it free on the nights I need it\".",
    howToUse: [
      "Move the week window to the rotation you are planning.",
      "Read down a house's rooms to find a clear run of nights.",
      "A bar shows the occupant's initials and the purpose of the stay.",
    ],
    worthKnowing: [
      "Ours pans by week. Legacy also pans by month, which is a wider view of the same data rather than a different one.",
    ],
    connectsTo: "The same bookings the house pages show, arranged by date instead of by house.",
    related: ["/housing", "/housing/reports"],
  },
  {
    route: "/housing/reports",
    title: "Housing reports",
    whoCanUse: ["exec_admin", "director_of_operations"],
    whatItDoes:
      "Occupancy, employee history and cost over a date range. Occupancy is room-nights used against room-nights available, which is the utilisation figure worth acting on rather than a snapshot of tonight.",
    howToUse: [
      "Set the period. It defaults to the current calendar month, which is what housing is usually reconciled against.",
      "Occupancy for utilisation by house; Employee History for who stayed where; Cost Tracking for what it came to.",
      "Export any tab to CSV for a finance hand-off.",
    ],
    sections: [
      {
        heading: "Reading the numbers honestly",
        steps: [
          "Nights are half-open: a stay from the 3rd to the 5th is two nights, not three.",
          "A house with no rooms entered reads \"not measured\" rather than 0% — there is no denominator, and it is a house nobody finished setting up.",
          "A room with no nightly rate is left out of the cost total, and the tab says so. It is not counted as free.",
          "An open-ended stay is counted to the end of the window rather than as zero.",
        ],
      },
    ],
    connectsTo:
      "Built from housing bookings and the nightly rate on each room. The rate is set on the room, so an unpriced room is fixed there.",
    related: ["/housing", "/housing/calendar"],
  },
  // ── Documents ───────────────────────────────────────────────────────
  {
    route: "/documents",
    title: "Document library",
    whoCanUse: ["pilot", "crew_member", "maintenance", "ground_ops", "dispatcher", "reservations_agent", "safety_officer", "chief_pilot", "check_airman", "director_of_maintenance", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The company's documents: the GOM, the OPM, safety bulletins, regulations and compliance references. One document that many people read — as distinct from the documents held about a person, which live on their employee record.",
    howToUse: [
      "Search by title, or filter by category.",
      "Tick \"Compliance sources only\" to narrow to the documents an operator has designated as stating company limitations.",
      "Open a document to read it, download it, or acknowledge it where acknowledgement is required.",
      "Required reading shows in the header when something is waiting on your acknowledgement.",
    ],
    sections: [
      {
        heading: "What \"compliance source\" means, and what it does not",
        body: "It is a per-document flag an operator sets, marking the document as stating a company limitation — weather minimums, wind limits, crew rules. It is deliberately not derived from the category: a category is a shelf, and a GOM chapter and a draft policy can sit on the same one while only the first is authoritative. The flag is set on the document itself.",
      },
    ],
    connectsTo:
      "Acknowledgements are per version, so a revision re-opens the requirement rather than silently inheriting the old receipt. Compliance sources are what the compliance checks draw on.",
    example:
      "A revision to the GOM is uploaded. Everyone who acknowledged revision 11 is asked again for revision 12, because the acknowledgement was against the version, not the document.",
    related: ["/documents/ack", "/employees"],
  },
  {
    route: "/documents/ack",
    title: "Required reading",
    whatItDoes:
      "Documents you are required to have read, and whether you have acknowledged the current version. An acknowledgement is against a version, so a revision brings the document back into your list.",
    howToUse: [
      "Read anything outstanding.",
      "Acknowledge it, which records your name and the time against that version.",
    ],
    connectsTo: "Drawn from documents the operator has marked as requiring acknowledgement.",
    related: ["/documents"],
  },
  // ── Daily operations ────────────────────────────────────────────────
  {
    route: "/schedule",
    title: "Schedule",
    whoCanUse: ["dispatcher", "chief_pilot", "director_of_operations", "reservations_agent", "exec_admin"],
    whatItDoes:
      "The flights planned, by day. Where Flight Following is about flights in progress, this is about flights intended — the list a dispatcher works down in the morning to see what has to be released.",
    howToUse: [
      "Pick the day.",
      "Open a flight to build or check its dispatch packet.",
      "Watch for flights without a crew or an aircraft — those are the ones that will not release.",
    ],
    connectsTo:
      "Flights arrive here from confirmed bookings and from being created directly. Releasing one moves it onto the Flight Following board.",
    related: ["/dispatch", "/flight-following", "/reservations/fleet-board"],
  },
  {
    route: "/manifest",
    title: "Manifest",
    whoCanUse: ["dispatcher", "reservations_agent", "ground_ops", "pilot", "exec_admin"],
    whatItDoes:
      "Who and what is on the aircraft: passengers, their weights, and cargo. It is the input to weight and balance, which is why a guessed weight here becomes a wrong envelope on the release.",
    howToUse: [
      "Open the flight's manifest.",
      "Add passengers with actual or standard weights, as the operator's policy requires.",
      "Add cargo with its weight and where it is loaded.",
      "Check the total against the aircraft before the packet is built.",
    ],
    connectsTo:
      "Feeds the dispatch packet's weight and balance, and the preflight step the pilot signs. Passenger counts come from the booking where there is one.",
    related: ["/dispatch", "/reservations", "/flight-crew"],
  },
  {
    route: "/weather",
    title: "Weather",
    whoCanUse: ["dispatcher", "pilot", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Weather for the stations the operation flies to, as briefings attached to a flight rather than a general forecast page. What matters on a release is what was current when it was signed, so briefings are kept with the flight.",
    howToUse: [
      "Open the station or the flight you need weather for.",
      "Read the briefing as it stood; it is retained rather than refreshed, so the record stays true to the decision.",
      "Use the Village Weather board for the small-strip picture across a region.",
    ],
    connectsTo:
      "Briefings attach to the dispatch packet and appear on the preflight. The village board reads the same station data arranged geographically.",
    related: ["/village-wx", "/dispatch", "/flight-crew"],
  },
  {
    route: "/village-wx",
    title: "Village weather",
    whoCanUse: ["dispatcher", "pilot", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Weather across the villages and small strips a bush operation serves, on one board. Reporting at these stations is thin and intermittent, so the board is as much about which stations have not reported as about what they said.",
    howToUse: [
      "Scan for stations with no recent report — an absent observation is not a good one.",
      "Read the reported conditions against the minimums the operation holds for that strip.",
      "Open a station for its history when a single observation looks implausible.",
    ],
    worthKnowing: [
      "A stale observation is shown as stale rather than as current. At strips reporting a few times a day, treating the last report as the present conditions is how a flight launches into something nobody checked.",
    ],
    connectsTo: "Station observations, the same source the per-flight briefings draw on.",
    related: ["/weather", "/dispatch"],
  },
  {
    route: "/eod",
    title: "End of day",
    whoCanUse: ["dispatcher", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The close-out: every flight for the day accounted for, and anything left open named. The point is that the day ends deliberately rather than by everyone going home — an unclosed flight is a record nobody will reconstruct tomorrow.",
    howToUse: [
      "Work the list of the day's flights.",
      "Chase any flight without a completion or a cancellation against it.",
      "Chase any completed flight without a filed log — those are the hours that never reach maintenance or payroll.",
      "Close the day once the list is clear.",
    ],
    connectsTo:
      "Reads the day's flights and their logs. Unfiled logs are what hold up airframe hours and pay events.",
    example:
      "At 19:00 the board shows eleven flights complete and one still airborne from the afternoon. The dispatcher calls the pilot, finds they landed at PAKN and forgot to update, and closes the day with all twelve accounted for.",
    related: ["/flight-following", "/flight-crew/elog", "/dispatch"],
  },
  {
    route: "/ramp-ops",
    title: "Ramp operations",
    whoCanUse: ["ground_ops", "dispatcher", "exec_admin"],
    whatItDoes:
      "The ground picture: what is on the ramp, what it needs, and what has been done to it. Written for the people working the aircraft rather than the people scheduling them.",
    howToUse: [
      "Read the aircraft on the ramp and the turn each is in.",
      "Record the ground work as it happens rather than at the end of the shift.",
    ],
    connectsTo: "Reads today's flights; ground records attach to the flight they belong to.",
    related: ["/ground-ops", "/flight-following"],
  },
  {
    route: "/ground-ops",
    title: "Ground operations",
    whoCanUse: ["ground_ops", "dispatcher", "exec_admin"],
    whatItDoes:
      "Ground handling across the stations: who is working, what equipment is available, and the load teams assigned.",
    howToUse: [
      "Check the station you are running.",
      "Confirm equipment availability before committing to a turn.",
      "Assign load teams to the flights that need them.",
    ],
    connectsTo: "Equipment and load teams come from Settings; flights from the day's schedule.",
    related: ["/ramp-ops", "/equipment", "/settings/load-teams"],
  },
  {
    route: "/fuel/orders",
    title: "Fuel orders",
    whoCanUse: ["ground_ops", "dispatcher", "maintenance", "exec_admin"],
    whatItDoes:
      "Fuel ordered against flights and stations, and where each order is up to. At remote stations fuel is the constraint the schedule bends around, so an order's state matters operationally rather than just commercially.",
    howToUse: [
      "Raise an order for the station and the quantity.",
      "Track it through to delivery.",
      "Record the quality check where the operator requires one.",
    ],
    connectsTo:
      "Suppliers and fuel types come from the fuel settings. Quality checks are held against the delivery.",
    related: ["/fuel", "/fuel/quality", "/fuel/suppliers"],
  },
  // ── AI tools ────────────────────────────────────────────────────────
  {
    route: "/ai/query",
    title: "AI query",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot"],
    whatItDoes:
      "Ask a question about the operation in plain language and get an answer drawn from its own data. Useful for the questions nobody built a report for — \"which aircraft did the most PABE legs last month\".",
    howToUse: [
      "Ask the question as you would ask a colleague.",
      "Read what it says it looked at, not only the answer.",
      "Check any figure you are going to act on against the page that owns it.",
    ],
    worthKnowing: [
      "Treat an answer as a lead rather than a record. It is generated from a reading of the data, and the page that owns a number is still the place to confirm it before it goes in front of a regulator or a customer.",
    ],
    connectsTo: "Reads operational data across the app.",
    related: ["/ai/morning-brief", "/reports/bi", "/fleetbrain"],
  },
  {
    route: "/ai/morning-brief",
    title: "Morning ops brief",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot", "dispatcher"],
    whatItDoes:
      "A written summary of where the operation stands at the start of the day: what is flying, what is grounded, who is short of currency, and what was left open yesterday.",
    howToUse: [
      "Read it before the morning brief rather than in it.",
      "Follow anything it flags through to the page that owns it.",
    ],
    connectsTo:
      "Draws on the day's flights, fleet availability, crew currency and open safety items.",
    related: ["/ai/query", "/dashboards/director-ops", "/eod"],
  },
  {
    route: "/ai/safety-intelligence",
    title: "Safety intelligence",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Looks across safety reports for patterns a single report does not show — the same hazard at one station, or a run of near misses in one phase of flight.",
    howToUse: [
      "Read the patterns it offers as candidates for a safety meeting agenda.",
      "Open the underlying reports before treating a pattern as real.",
    ],
    worthKnowing: [
      "A pattern here is a prompt to look, not a finding. Three reports that share wording may share a cause or may share a reporter; the reports themselves are what settles it.",
    ],
    connectsTo: "Reads hazard reports and incidents from the SMS.",
    related: ["/safety", "/safety/dashboard", "/safety/incidents"],
  },
  {
    route: "/ai/delay-alerts",
    title: "Delay alerts",
    whoCanUse: ["dispatcher", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Flags flights at risk of running late, early enough to do something about it. It is a watch list rather than a record of delays that already happened.",
    howToUse: [
      "Read the flights flagged and the reason against each.",
      "Act on the ones where there is still a decision to make.",
    ],
    connectsTo: "Reads the day's flights, their times and the aircraft's position.",
    related: ["/flight-following", "/ai/morning-brief"],
  },
  {
    route: "/fleetbrain",
    title: "Fleet Brain",
    whoCanUse: ["exec_admin", "director_of_operations", "director_of_maintenance", "chief_pilot"],
    whatItDoes:
      "Fleet-level analysis: how the aircraft are being used, where the hours are going, and what that implies for maintenance and cost.",
    howToUse: [
      "Read the fleet summary before drilling into one airframe.",
      "Confirm anything you are going to schedule against the maintenance due list.",
    ],
    connectsTo: "Reads airframe hours, maintenance records and flight activity.",
    related: ["/maintenance/mx-clock", "/profitability", "/ai/query"],
  },
  {
    route: "/fuel/quality",
    title: "Fuel quality",
    whoCanUse: ["ground_ops", "maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "The quality checks recorded against fuel deliveries — the sump checks and sample results that have to exist afterwards, not just be done at the time.",
    howToUse: [
      "Record the check against the delivery it belongs to.",
      "Note the result, including a clean one; an absent record is indistinguishable from a skipped check.",
      "Read the history for a station when a batch is in question.",
    ],
    connectsTo: "Attaches to fuel deliveries and the orders behind them.",
    related: ["/fuel/orders", "/fuel", "/maintenance/batch-trace"],
  },
  // ── Dashboards ──────────────────────────────────────────────────────
  {
    route: "/dashboards/executive",
    title: "Executive dashboard",
    whoCanUse: ["exec_admin", "director_of_operations"],
    whatItDoes:
      "The operation on one screen for somebody accountable for it rather than running it: activity, revenue, fleet state, and where the risk sits today.",
    howToUse: [
      "Read the fleet and safety panels first — those are the ones that stop flying.",
      "Follow any figure through to its own page before quoting it.",
    ],
    sections: [
      {
        heading: "Where each panel's number comes from",
        steps: [
          "Flight activity — completed flights and their block hours, from filed flight logs.",
          "Fleet — availability from open work orders, the RTS queue and MEL deferrals.",
          "Crew — currency items lapsed or inside their warning window.",
          "Safety — open hazard reports and corrective actions.",
          "Revenue — completed bookings, which is billing rather than accounting.",
        ],
      },
    ],
    worthKnowing: [
      "A panel that cannot compute says so rather than showing a zero. A rate of zero and \"not measured\" are different claims, and a dashboard that renders the second as the first is worse than one that leaves the panel out.",
    ],
    connectsTo: "Aggregates from the pages named above; nothing originates here.",
    related: ["/dashboards/director-ops", "/reports/bi", "/profitability"],
  },
  {
    route: "/dashboards/director-ops",
    title: "Director of Operations dashboard",
    whoCanUse: ["director_of_operations", "exec_admin"],
    whatItDoes:
      "The operational view for the post-holder accountable for how the flying is conducted: compliance state, crew readiness, and what is open against the operation.",
    howToUse: [
      "Read lapsed currency and open safety items first.",
      "Use it as the agenda for the morning brief rather than as a record.",
    ],
    connectsTo: "Reads crew currency, safety items, fleet availability and the day's flights.",
    related: ["/dashboards/executive", "/compliance/crew-currency", "/safety"],
  },
  {
    route: "/dashboards/chief-pilot",
    title: "Chief pilot dashboard",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Crew state for the person responsible for it: who is current, who is close to lapsing, whose flight logs need review, and what training is outstanding.",
    howToUse: [
      "Work the review queue — an unreviewed log is an open item in the record.",
      "Read currency by exception rather than reading the whole matrix.",
    ],
    connectsTo: "Reads crew currency, the flight-log review queue and training assignments.",
    related: ["/compliance/crew-currency", "/flight-crew/elog/cp-reviews", "/academy/assignments"],
  },
  {
    route: "/dashboards/dispatcher",
    title: "Dispatcher dashboard",
    whoCanUse: ["dispatcher", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The dispatcher's shift on one screen: flights to release, flights in progress, and anything blocking a release.",
    howToUse: [
      "Clear the blocked flights first — those are the ones that will not go.",
      "Watch overdue position reports on the in-progress list.",
    ],
    connectsTo: "Reads the day's flights, their packets and fleet availability.",
    related: ["/dispatch", "/flight-following", "/schedule"],
  },
  {
    route: "/dashboards/system-health",
    title: "System health",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Whether the platform itself is working: the services behind each part of the app, and anything degraded. Read when the app is behaving oddly, to tell a platform problem from an operational one.",
    howToUse: [
      "Read the service list for anything not healthy.",
      "A degraded service tells you which pages to distrust until it clears.",
    ],
    connectsTo: "Reads the health of the services the app runs on.",
    related: ["/dashboards", "/settings"],
  },
  {
    route: "/dashboards/ops-score",
    title: "Ops score",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot"],
    whatItDoes:
      "A composite score for how the operation is running, built from completion, compliance and safety inputs so that a single trend line can be read week to week.",
    howToUse: [
      "Read the trend rather than the absolute number.",
      "Open the contributing figures before drawing a conclusion from a move.",
    ],
    worthKnowing: [
      "A composite hides which input moved. It is useful for noticing that something changed and poor for explaining what, so the contributing pages are the ones to act on.",
    ],
    connectsTo: "Built from flight completion, compliance state and safety activity.",
    related: ["/dashboards/executive", "/reports/bi"],
  },
  {
    route: "/dashboards/station",
    title: "Station dashboard",
    whoCanUse: ["ground_ops", "dispatcher", "exec_admin"],
    whatItDoes:
      "One station's picture: the flights in and out today, the ground resources there, and anything outstanding at that location.",
    howToUse: [
      "Pick your station.",
      "Read arrivals and departures against the ground resource you have.",
    ],
    connectsTo: "Reads the day's flights filtered to the station, plus its ground resources.",
    related: ["/ground-ops", "/stations", "/flight-following"],
  },
  // ── HR, time and pay ────────────────────────────────────────────────
  {
    route: "/employees",
    title: "Employees",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The staff directory and each person's record: identity, employment details, contact and emergency contact, their certificate record where they hold one, and the documents required of them.",
    howToUse: [
      "Search the directory for the person.",
      "Edit the profile fields and save — the record is one form rather than several.",
      "Certifications appear on the record for anyone holding an airman certificate.",
      "Use the Documents tab for the documents required of them, and to file one.",
    ],
    worthKnowing: [
      "Exec Admin only, and deliberately: the record carries a date of birth, a home address and an emergency contact. That is also why an employee cannot currently open their own record.",
      "Onboarding and Drug & Alcohol are shown as tabs and marked not built. Each is a subsystem rather than a screen — legacy carries five tables behind one and nine behind the other, the second including the 14 CFR 120.217 annual summary — and neither is scheduled.",
    ],
    connectsTo:
      "The certificate record is the same 135.63 record the compliance profile shows. Required documents are defined once in Settings and appear on everyone they apply to.",
    related: ["/settings/document-requirements", "/compliance/crew-currency", "/payroll"],
  },
  {
    route: "/time-clock",
    title: "Time clock",
    whatItDoes:
      "Clocking in and out, and the hours that result. The clock in the top bar is the same thing from wherever you are in the app.",
    howToUse: [
      "Clock in at the start of your shift and out at the end.",
      "Check the current period for what has been recorded against you.",
      "Raise anything wrong with a supervisor rather than editing around it.",
    ],
    connectsTo:
      "Clocked time becomes pay events, which are what a payroll period is built from.",
    related: ["/payroll", "/payroll/periods"],
  },
  {
    route: "/payroll",
    title: "Payroll",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Pay events and the periods they roll into. An event is created by something happening — a clocked shift, a completed flight — rather than typed, so the period is a reading of the operation rather than a separate record of it.",
    howToUse: [
      "Review the events in the open period.",
      "Investigate anything without a source rather than adjusting it.",
      "Lock the period when it is agreed, then export.",
    ],
    sections: [
      {
        heading: "Where a pay event comes from",
        steps: [
          "A clocked shift from the time clock.",
          "A completed flight, where the pilot's rate pays by the hour or the leg.",
          "A manual entry, which carries whoever entered it.",
        ],
      },
    ],
    connectsTo:
      "Rates come from Settings → Pilot Pay. Flight-driven events come from filed flight logs. A locked period exports for the payroll provider.",
    related: ["/payroll/periods", "/settings/pilot-pay", "/time-clock"],
  },
  {
    route: "/payroll/periods",
    title: "Payroll periods",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The pay periods themselves: what is open, what is locked, and what has been exported. Locking is the point at which the numbers stop moving.",
    howToUse: [
      "Open the period to review its events.",
      "Lock it once it is agreed — events stop accruing to a locked period.",
      "Export the locked period as CSV for the payroll provider.",
    ],
    connectsTo: "Built from pay events; exports for an external payroll system.",
    related: ["/payroll", "/settings/pilot-pay"],
  },
  {
    route: "/dashboards",
    title: "Dashboards",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot", "dispatcher"],
    whatItDoes:
      "The admin dashboards, one per role that has one. Each aggregates from pages that own the underlying records; nothing originates on a dashboard.",
    howToUse: [
      "Open the dashboard for your post rather than reading all of them.",
      "Follow any figure through to the page behind it before acting on it.",
    ],
    worthKnowing: [
      "Reaching these depends on the Admin Access toggle for your role, set per operator on the Permissions page — not on the role alone. A post-holder whose toggle is off is redirected home.",
    ],
    connectsTo: "Aggregates flights, fleet availability, crew currency and safety items.",
    related: ["/dashboards/executive", "/dashboards/director-ops", "/settings/permissions"],
  },
  // ── Money ───────────────────────────────────────────────────────────
  {
    route: "/invoicing",
    title: "Invoicing",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Invoices raised against completed work, and what has been paid. Built from bookings and charters that have flown rather than entered separately, so an invoice traces back to a flight.",
    howToUse: [
      "Raise an invoice from the completed work it covers.",
      "Check the lines against the flights before sending.",
      "Record payment when it arrives.",
    ],
    connectsTo:
      "Reads completed bookings and charter quotes. Feeds the accounting export and the profitability report.",
    related: ["/accounting", "/profitability", "/reservations/accounting-export"],
  },
  {
    route: "/accounting",
    title: "Accounting",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The financial view of the operation, and the exports that hand it to whatever the operator keeps its books in. This app is not the ledger; it is the source the ledger is fed from.",
    howToUse: [
      "Set the period you are closing.",
      "Reconcile the export against the invoices raised in it.",
      "Export for the accounting system.",
    ],
    connectsTo: "Reads invoices, bookings and flight activity.",
    related: ["/invoicing", "/profitability", "/reservations/accounting-export"],
  },
  {
    route: "/reservations/accounting-export",
    title: "Accounting export",
    whoCanUse: ["exec_admin", "reservations_agent"],
    whatItDoes:
      "The bookings-side export: completed bookings for a period, as a file the operator's accounting system can take.",
    howToUse: [
      "Set the period.",
      "Check the row count against what you expect before exporting.",
      "Export, and keep the file with the period's paperwork.",
    ],
    worthKnowing: [
      "A flight with no booking behind it will not appear here, because the export is built from bookings. Charter work invoiced directly is on the invoicing side instead.",
    ],
    connectsTo: "Reads completed bookings; pairs with invoicing for the charter side.",
    related: ["/invoicing", "/accounting", "/reservations"],
  },
  // ── Settings ────────────────────────────────────────────────────────
  {
    route: "/settings/users",
    title: "Users",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Who has an account, what roles they hold, and whether they are active. Roles are what the app gates on, so this page decides what each person can reach.",
    howToUse: [
      "Create the user with the roles their job needs, not more.",
      "Deactivate rather than delete when somebody leaves — their records stay attached to them.",
      "Set a password only where SSO is not in use.",
    ],
    connectsTo:
      "Roles drive page access and the API's own checks. The employee record holds the HR detail; this page holds the account.",
    related: ["/settings/permissions", "/employees", "/settings/sso"],
  },
  {
    route: "/settings/permissions",
    title: "Permissions",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The role catalogue, and the per-operator Admin Access switch on each role. Admin Access is what decides whether a role can reach the dashboards.",
    howToUse: [
      "Read the catalogue to see what each role is for.",
      "Turn Admin Access on for the roles this operator wants in the dashboards.",
      "A change takes effect at the user's next sign-in, because the flag is carried in their session.",
    ],
    worthKnowing: [
      "The role list is not editable here. Roles are a code-level constant, so that a page gate cannot be written against a role that an operator later renames or deletes.",
    ],
    connectsTo: "The Admin Access flag gates /dashboards/*.",
    related: ["/settings/users", "/dashboards"],
  },
  {
    route: "/settings/pilot-pay",
    title: "Pilot pay",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The rate tables pay events are computed from: what a pilot earns, by aircraft and duty position where the operator pays that way.",
    howToUse: [
      "Set the rate per pilot, or per role where the operator pays by role.",
      "Say what the rate is per — block hour, flight hour, or leg.",
      "Check a recent flight's pay event after changing a rate, to confirm it computed as you expect.",
    ],
    worthKnowing: [
      "Changing a rate does not re-price pay events already created. A locked period stays as it was agreed, which is the point of locking it.",
    ],
    connectsTo: "Read when a completed flight creates a pay event.",
    related: ["/payroll", "/payroll/periods", "/settings/costs"],
  },
  {
    route: "/settings/flight-tracking",
    title: "Flight tracking",
    whoCanUse: ["exec_admin", "director_of_operations"],
    whatItDoes:
      "How the operation expects position reports: how often, and how long a gap before a flight counts as overdue. These settings are what make the Flight Following board raise an alert rather than sit quietly.",
    howToUse: [
      "Set the reporting interval the operation actually works to.",
      "Set the overdue threshold — the gap after which a dispatcher should be chasing.",
      "Check the board after changing it; the thresholds decide what shows as overdue there.",
    ],
    worthKnowing: [
      "A generous threshold makes the board quiet and the operation blind. The number should be the one the operator would defend, not the one that produces the fewest alerts.",
    ],
    connectsTo: "Drives overdue detection on the Flight Following board and the delay alerts.",
    related: ["/flight-following", "/ai/delay-alerts", "/settings"],
  },
  {
    route: "/settings/fleet",
    title: "Fleet",
    whoCanUse: ["exec_admin", "director_of_maintenance"],
    whatItDoes:
      "The aircraft the operator holds: tails, types, and the figures the rest of the app computes against — seats, weights and the airframe's limits.",
    howToUse: [
      "Add the aircraft with its tail number and type.",
      "Enter the weights and limits carefully; weight and balance is computed from them.",
      "Retire an aircraft rather than deleting it — its flights and maintenance history stay attached.",
    ],
    connectsTo:
      "Aircraft appear on the fleet board, in dispatch packets, and in maintenance. Weight and balance reads the limits entered here.",
    related: ["/settings", "/maintenance/availability", "/reservations/fleet-board"],
  },
  {
    route: "/settings/bases",
    title: "Bases and stations",
    whoCanUse: ["exec_admin", "director_of_operations"],
    whatItDoes:
      "The stations the operation works from, and which are crew bases. Bases are what the roster and housing organise around.",
    howToUse: [
      "Add the station with its identifier.",
      "Mark it as a crew base where crew are assigned there.",
    ],
    connectsTo: "Bases drive the roster's grouping and the housing stations.",
    related: ["/settings", "/compliance/roster", "/housing"],
  },
  {
    route: "/settings/company",
    title: "Company profile",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The operator's own details: name, certificate details, contact, and the identifiers that appear on regulatory filings and exports.",
    howToUse: [
      "Fill in the details as they appear on the certificate.",
      "Set the carrier code before using the schedule export — that export refuses to run without one rather than guessing.",
    ],
    worthKnowing: [
      "The carrier code has no default on purpose. It is the field a receiving system keys on to decide whose flights these are, so a guessed one files this operator's schedule under somebody else's code.",
    ],
    connectsTo: "Read by the regulatory returns and the schedule export.",
    related: ["/settings", "/reports/regulatory", "/reports/sim"],
  },
  {
    route: "/settings/billing",
    title: "Billing",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The operator's own subscription to this platform: the plan, the payment method, and the invoices for it. Distinct from Invoicing, which is what the operator bills its own customers.",
    howToUse: [
      "Read the current plan and what it includes.",
      "Update the payment method here rather than through support.",
    ],
    connectsTo: "The platform's own billing, not the operation's.",
    related: ["/settings", "/invoicing"],
  },
  // ── Reference data ──────────────────────────────────────────────────
  {
    route: "/customers",
    title: "Customers",
    whoCanUse: ["reservations_agent", "exec_admin"],
    whatItDoes:
      "The people and companies the operator flies for: contact details, booking history, and rewards membership where they hold one. A customer record is what a booking attaches to, so it is worth getting right once rather than retyping per trip.",
    howToUse: [
      "Search before creating — a duplicate customer splits somebody's history in two.",
      "Open a customer for their bookings and their balance.",
      "Create a new one from here, or during a booking when the caller is new.",
    ],
    connectsTo:
      "Bookings attach to a customer. Rewards membership and invoicing both read the customer record.",
    related: ["/reservations", "/reservations/rewards", "/invoicing"],
  },
  {
    route: "/stations",
    title: "Stations",
    whoCanUse: ["exec_admin", "director_of_operations", "ground_ops"],
    whatItDoes:
      "The airports and strips the operation serves, with the detail the rest of the app needs about each — identifier, name, and what is available there.",
    howToUse: [
      "Add a station with its identifier, since that is what flights and weather key on.",
      "Keep the list to stations actually served; an unused station clutters every route picker in the app.",
    ],
    connectsTo:
      "Flights, weather briefings and the village weather board all key on stations. Crew bases are stations marked as such in Settings.",
    related: ["/settings/bases", "/village-wx", "/dashboards/station"],
  },
  {
    route: "/equipment",
    title: "Ground equipment",
    whoCanUse: ["ground_ops", "maintenance", "exec_admin"],
    whatItDoes:
      "The ground support equipment the operator holds, by station, and whether each item is serviceable. A turn that needs a loader and a de-icer depends on both being available, which is what this list answers.",
    howToUse: [
      "Filter to the station you are working.",
      "Record an item as unserviceable as soon as it fails, rather than at the end of the shift.",
      "Check availability before committing to a turn that needs it.",
    ],
    connectsTo: "Read by ground operations when planning a turn.",
    related: ["/ground-ops", "/ramp-ops", "/stations"],
  },
  {
    route: "/fuel",
    title: "Fuel",
    whoCanUse: ["ground_ops", "maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Fuel across the operation: what has been ordered, from whom, at what price, and the quality checks against each delivery. At remote stations fuel is the constraint the schedule bends around rather than a line on an invoice.",
    howToUse: [
      "Start from Orders for what is in flight and what has landed.",
      "Use Suppliers and Types to keep the reference data the orders draw on.",
      "Record quality checks against the delivery they belong to.",
    ],
    connectsTo:
      "Orders reference suppliers and fuel types. Quality records attach to deliveries. Fuel cost feeds the profitability report.",
    related: ["/fuel/orders", "/fuel/suppliers", "/fuel/quality"],
  },
  {
    route: "/fuel/suppliers",
    title: "Fuel suppliers",
    whoCanUse: ["exec_admin", "ground_ops", "director_of_maintenance"],
    whatItDoes:
      "Who the operator buys fuel from, per station, and on what terms. Orders are raised against these, so the list is what makes an order more than free text.",
    howToUse: [
      "Add the supplier with the stations they serve.",
      "Keep pricing current — orders and the profitability report read it.",
    ],
    connectsTo: "Fuel orders reference a supplier; pricing feeds cost reporting.",
    related: ["/fuel", "/fuel/orders", "/fuel/types"],
  },
  {
    route: "/fuel/types",
    title: "Fuel types",
    whoCanUse: ["exec_admin", "ground_ops", "director_of_maintenance"],
    whatItDoes:
      "The grades the operation uses, so an order says which fuel rather than just how much. Getting this wrong on an order is not a paperwork problem.",
    howToUse: [
      "Keep the list to the grades actually uplifted at your stations.",
      "Name each grade as the supplier's paperwork names it, so an order and a delivery note can be reconciled.",
      "Retire a grade rather than renaming it — orders already placed reference it.",
    ],
    connectsTo:
      "Referenced by fuel orders and by the quality records held against a delivery.",
    related: ["/fuel", "/fuel/orders"],
  },
  {
    route: "/ramper",
    title: "Ramp agent view",
    whoCanUse: ["ground_ops"],
    whatItDoes:
      "The ramp agent's own screen: the aircraft they are working, what each turn needs, and what to record. Deliberately narrow — it shows the work in front of the person rather than the whole operation.",
    howToUse: [
      "Read the turns assigned to you.",
      "Record the work as you do it, not afterwards.",
      "File a safety report from the button in the corner if something is unsafe — it works from here like everywhere else.",
    ],
    connectsTo: "Reads today's flights at your station; records attach to the flight.",
    related: ["/ramp-ops", "/ground-ops", "/safety/report"],
  },
  {
    route: "/settings/document-requirements",
    title: "Document requirements",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The documents the operation requires of its staff, and of whom. Defined once here; each one then appears on the Documents tab of every employee it applies to. Distinct from the document library, which is the company's own documents that people read.",
    howToUse: [
      "Create a requirement and name it as the document is known to the people filing it.",
      "Scope it to roles, or leave the roles empty to require it of everyone.",
      "Say whether it carries an expiry, and how far ahead to start warning.",
      "Retire one when it no longer applies — retiring keeps the documents already filed against it.",
    ],
    sections: [
      {
        heading: "Why the expiry setting matters more than it looks",
        body: "Turning it on makes an expiry date mandatory on upload. A certificate whose expiry nobody recorded is worse than one nobody uploaded, because it reads as current forever — so the checklist gives that case its own state, \"no expiry recorded\", rather than calling it on file.",
      },
      {
        heading: "What the states on an employee's checklist mean",
        steps: [
          "Missing — the requirement applies and nothing is on file.",
          "On file — filed, and either it does not expire or it is comfortably ahead of doing so.",
          "Expiring — filed, with the expiry inside the warning window set here.",
          "Expired — filed, and the expiry has passed.",
          "No expiry recorded — filed, this requirement wants an expiry, and none was captured. It cannot be checked.",
        ],
      },
    ],
    worthKnowing: [
      "\"Required on hire\" is recorded and shown on the checklist, and does not block activating a new hire. Legacy's equivalent does. Letting a document requirement lock a real person out of the system is an enforcement decision rather than a side effect of ticking a box here.",
      "Retiring a requirement deactivates it rather than deleting it. A certificate somebody filed is a record even after the operator stops asking for it.",
    ],
    connectsTo:
      "Every employee's Documents tab is built from this list, filtered to the roles they hold. The warning window set here is what decides when an item starts reading as expiring.",
    example:
      "An operator requires a medical certificate of pilots with a 30-day warning, and a driving licence of everyone with no expiry. A pilot's record then shows two rows; a ramp agent's shows one.",
    related: ["/employees", "/settings", "/documents"],
  },
];

/** Longest-prefix match, so a department entry covers its children
 *  until one of them has an article of its own. The same rule the
 *  department nav uses to decide which department a path belongs to. */
export function helpFor(pathname: string): HelpEntry | null {
  let best: HelpEntry | null = null;
  for (const entry of HELP_ENTRIES) {
    if (pathname === entry.route || pathname.startsWith(`${entry.route}/`)) {
      if (!best || entry.route.length > best.route.length) best = entry;
    }
  }
  return best;
}

/** Free-text search across every field a reader would recognise.
 *
 *  Title matches rank above body matches: somebody typing "manifest"
 *  wants the manifest article before every article that mentions one. */
export function searchHelp(query: string): HelpEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const scored: { entry: HelpEntry; score: number }[] = [];
  for (const entry of HELP_ENTRIES) {
    const title = entry.title.toLowerCase();
    // The example and the deep-dive sections are searched too. They
    // carry the most specific language in an article — station names,
    // MEL categories, the word "half-open" — and leaving them out
    // would make the richest part of the content the least findable.
    const body = [
      entry.whatItDoes,
      ...entry.howToUse,
      entry.connectsTo ?? "",
      ...(entry.worthKnowing ?? []),
      entry.example ?? "",
      ...(entry.sections ?? []).flatMap((sec) => [
        sec.heading,
        sec.body ?? "",
        ...(sec.steps ?? []),
      ]),
    ]
      .join(" ")
      .toLowerCase();
    if (title.includes(needle)) scored.push({ entry, score: 2 });
    else if (body.includes(needle)) scored.push({ entry, score: 1 });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.title.localeCompare(b.entry.title),
    )
    .map((s) => s.entry);
}
