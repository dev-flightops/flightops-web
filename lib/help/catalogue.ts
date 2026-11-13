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
      "Alerts summarize the supported operational checks; review the underlying flight and maintenance records for their full context.",
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
      "Generate PDF when the packet is clear: it releases the flight and opens the dispatch packet.",
    ],
    connectsTo:
      "Reads the manifest for weight and balance, the maintenance file for airworthiness, crew records for currency, and the weather service for the briefing. A release writes to the flight record and is what the flight board reads to show a flight as released.",
    worthKnowing: [
      "Peregrine checks the weight; it doesn't calculate the CG or check the balance envelope. When the flight's ForeFlight plan comes back, a weight or the CG outside its limits there holds the release; otherwise balance must be verified with the approved aircraft loading procedure. No AI helper can certify it or supply missing approved aircraft data.",
      "The packet shows each pilot's standing in their seat on the aircraft's type. Once aircraft qualifications are switched on in Settings → Currency, a PIC who isn't current as PIC on the type is a hard block that a Chief Pilot, Director of Operations or Exec Admin can override for that one flight. The PIC picker and the crew panel name the problem beside each pilot.",
      "The Risk Assessment scores the flight the way the operator's original dispatch tool did: each applicable factor's severity times its likelihood, with no-cue/not-applicable factors unscored, the worst row setting LOW (up to 5), MEDIUM (up to 12) or HIGH. Weather and PIREPs, runways, the company's crosswind limits from Settings → Flight Risk, open MELs, hazmat on the manifest, the aircraft's 100-hour and night are worked out automatically, and the dispatcher can override any of them. Each stop's ceiling, visibility and wind are the worst current reading of its METAR, its FAA WeatherCam (a VWOS reading, or the cameras' estimated visibility) and its village report, and the weather card names the source; where any of it isn't certified, the packet says that only an operator whose OpSpecs authorize non-certified weather may use it for dispatch. Outside Pilot Restrictions and VFR Mountain Terrain at Night are the dispatcher's answers. A stop whose runway isn't known scores HIGH until it's entered under Stations.",
      "The dispatch packet PDF is laid out as the operator's original was: the risk matrix and its plain-English summary, the AAWU icing and turbulence charts, each stop's METAR, TAF and PIREPs, the area forecast for the region chosen in Flight Details, the non-certified FAA WeatherCam and village readings and whether each was scored, the dispatcher's notes, the NOTAMs reviewed, open MELs and the signature block. The weather and risk are kept as they were at release, so printing it later shows what the flight was released on. A flight released before packets were kept prints today's weather and says so. The company logo from Settings → Company prints at the top, as on the original.",
      "Building a flight is reachable from here as well as from Flight Following. It was only on Flight Following until an operator reported being unable to find it.",
      "The packet’s Peregrine Assistant explains how to use the app; it cannot read or change the flight. AI Review is not available. Dispatch Intelligence, which suggests aircraft for a next leg, is a separate page.",
    ],
    related: ["/dispatch/intelligence", "/flight-following", "/weather"],
  },
  {
    route: "/dispatch/intelligence",
    title: "Dispatch Intelligence",
    whatItDoes:
      "Suggests which aircraft could fly a next leg, ranked, with the reason for each — including a run for passengers, mail and freight waiting where it lands with no flight to take them. Aircraft that cannot legally be flown are shown with the reason and carry no rank at all.",
    howToUse: [
      "Open it with an airborne aircraft in the operation; the page lists the feasible options.",
      "Read each option's reason before its rank. The rank comes from a documented precedence, not a score: a scheduled flight with passengers booked, then a run for what is waiting, then a scheduled flight with nothing booked, then repositioning, then hold.",
      "A waiting-load run says what it can take — passengers by seats and weight, then mail and freight in USPS priority order — sized at planning weights with the trip's fuel, and when it is back. It is blocked when the pilot would be past the company duty limit by then.",
      "Anything shown as blocked names what blocks it — grounded, MEL overdue, hundred-hour overdue, annual overdue, the pilot's duty limit.",
    ],
    connectsTo:
      "Reads the flight board for what is airborne, the fleet's airworthiness for what can legally fly, bookings without a flight and the mail and freight waiting list for what a run could carry, and the shared cost model for the cost of an hour and a type's fuel burn.",
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
      "The Due List is where hours and calendar milestones count down. The Maintenance Clock tracks the time an aircraft spends in the shop.",
    ],
    connectsTo:
      "Grounding an aircraft removes it from dispatch immediately and raises an alert on the home page and the bell. Airframe and engine hours come from crew flight logs.",
    worthKnowing: [
      "Grounded means a grounding timestamp is set, which the auto-grounding job does when a MEL expires. That is a different test from whether the aircraft is marked active.",
      "Use Settings → Fleet to add or edit aircraft. Dedicated Inspections, Vendors and maintenance Roster pages are not available.",
    ],
    related: ["/maintenance/due-list", "/maintenance/work-orders", "/dispatch"],
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
    route: "/settings/foreflight",
    title: "ForeFlight",
    whatItDoes:
      "Connects the company's ForeFlight Dispatch account, so each flight scheduled here appears in ForeFlight with its crew, passengers and cargo for the pilot to plan, and the pilot's plan comes back onto the flight.",
    howToUse: [
      "Have your ForeFlight Dispatch administrator generate an API key (Tools → API Console → Generate API Key) and paste it here. The page checks it at once and names the account.",
      "Read the check: aircraft ForeFlight doesn't have can't be sent, and crew without a ForeFlight user of the same email are left off their flights.",
      "Turn sending on. Every five minutes, legs scheduled in the next 72 hours are created or brought up to date; Send now does it at once.",
      "Turn bringing plans back on. Every five minutes, the flights pilots planned or changed in ForeFlight come back with their route, fuel, times and weight and balance; Fetch now does it at once.",
    ],
    connectsTo:
      "Reads the flight board, crew assignments and manifests. Plans that come back show on each flight's dispatch page; plans no single leg fits wait on the ForeFlight plans page.",
    worthKnowing: [
      "Only the Director of Operations or an Exec Admin sees this page: the key reads and writes the company's ForeFlight account. It can be replaced but is never shown again.",
      "A flight released here, or released in ForeFlight, is left alone from then on. A cancelled flight is taken out of ForeFlight unless ForeFlight already released it.",
      "Peregrine's own weight check stays on the record. What's sent pre-loads the pilot's weight and balance in ForeFlight. A plan that comes back with a weight or the CG outside its limits holds the release until the load or the plan is fixed and the plan comes back again. Peregrine does not itself calculate CG or check the aircraft's balance envelope.",
    ],
    related: ["/settings", "/dispatch", "/dispatch/foreflight-plans"],
  },
  {
    route: "/dispatch/foreflight-plans",
    title: "ForeFlight plans waiting",
    whatItDoes:
      "Lists the plans pilots made in ForeFlight that no single leg here fits, so a dispatcher can put each on its leg or set it aside.",
    howToUse: [
      "Read why each plan waits: no flight on its aircraft near its time, or more than one leg that fits.",
      "Choose the leg from the aircraft's legs within a day either side, and put the plan on it. It then shows on that flight's dispatch page.",
      "Set aside a plan that belongs to no flight here, such as a training or positioning flight planned only in ForeFlight.",
    ],
    connectsTo:
      "Fed by Settings → ForeFlight once bringing plans back is on. The dispatch page shows a banner while any plan waits.",
    worthKnowing: [
      "A plan for a leg sent from here finds its leg by itself, and so does a pilot's own plan when exactly one leg has its tail and airports within three hours of its time.",
      "Either decision stands when ForeFlight sends the plan again.",
      "A dispatcher, the Director of Operations or an Exec Admin places plans.",
    ],
    related: ["/settings/foreflight", "/dispatch"],
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
      "High routes a flight through dispatch via the release packet. Extreme cannot depart without a Chief Pilot or Director of Operations authorisation recorded against it. The questionnaire itself is step 1 of a pilot's preflight, which is reached per flight rather than as a page of its own.",
    worthKnowing: [
      "No FAR sets these numbers — Part 135 does not require a flight risk assessment tool at all — so they belong to whoever signs your manual. What ships is a starting point, not guidance.",
      "Changing a threshold changes the band new assessments land in. Assessments already submitted keep the band they were scored under.",
    ],
    sections: [
      {
        heading: "Limits from your documents",
        body: "A Chief Pilot, Director of Operations or Exec Admin can have a manual read for the company limits on this page: crosswind for single and multi engine, how near a limit counts as elevated risk, and the VFR ceiling and visibility floor. Mark the manual as a compliance source in the Document Library, then choose it under Limits from your documents and select Read limits. Only pages that mention wind or weather are read, and a reading takes up to a minute. Each limit found is shown with the page and sentence it came from, beside the value set now. A limit is kept only if that sentence really is on that page. Reading changes nothing: a proposal waits for someone to decide.",
      },
      {
        heading: "Approving a limit",
        body: "Approve sets the limit to the value read; Change… lets you approve a different value instead, and the citation then also says what the page was read as. Reject leaves the setting as it is. An approved limit shows its document, version, page and approver under its field, and the FRAT names the document beside the limit it scored a flight against. Change that limit by hand and save, and it no longer claims the document's backing. A limit whose new value would break the policy, such as a near margin no longer smaller than the crosswind limit, is refused with the reason.",
      },
      {
        heading: "When the document changes",
        body: "Upload a new version of a document, or archive it, and every limit approved from it keeps its value but is marked for a re-check: under its field here, and on the FRAT beside the limit. Read the new version and approve the limit again to clear it.",
      },
    ],
    related: ["/dispatch", "/settings", "/documents"],
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
      "The day's bookings laid out by aircraft. Each aircraft is a row and each booking is a block; several bookings can belong to one flight. Booking counts are not flight or leg counts, so compare them with the same population.",
    howToUse: [
      "Pick the date you are selling against.",
      "Read down the aircraft rows to find an airframe with room.",
      "Click a booking block to open its details and follow its assigned-flight link when present.",
      "Use the list view instead when you want to sort or scan by time rather than by aircraft.",
    ],
    connectsTo:
      "Blocks come from booking records and their aircraft/flight assignments. Aircraft rows come from the fleet in Settings; unassigned demand still needs an eligible flight.",
    example:
      "An agent is asked for a same-day charter to PADU. The board shows the 208B free after 14:00 and the Navajo committed all afternoon, so they quote the 208B and avoid a conflict that a list view would have buried.",
    worthKnowing: [
      "Drag a booking block onto another aircraft row, review the confirmation and confirm the move. A flight-linked booking moves its flight and the other bookings on that flight; availability, capacity and release-state checks can refuse the move. For another day, edit the booking/flight date rather than dragging horizontally.",
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
      "A pilot's flights, daily aircraft preflight/run-up, flight-release review and acceptance, logbook and currency. Dispatch releases the flight; the assigned pilot reviews and accepts it.",
    howToUse: [
      "Open the flight you are about to operate to start its preflight.",
      "Duty in, take the aircraft on Flight Crew and record its daily preflight and run-up before accepting a flight in it. Then work the flight’s eight preflight steps in order: signing the FRAT dispatch signed comes first, then the dispatch release review, and pilot acceptance is step 6.",
      "File the electronic flight log after the flight, while the numbers are still in front of you.",
      "Check your currency before accepting a flight that needs a qualification you are close to losing.",
    ],
    sections: [
      {
        heading: "The preflight steps",
        body: "The flow is deliberately linear. Each step writes something the next one reads, so skipping ahead would mean signing a release against numbers nobody had entered yet.",
        steps: [
          "Dispatch release — the packet the dispatcher built, for the pilot to accept or reject.",
          "Weight check — loaded from the manifest and checked against the aircraft’s weight limits. Peregrine doesn’t calculate the CG: balance is checked in the flight’s ForeFlight plan when one has come back, otherwise with the approved aircraft loading procedure.",
          "Weather and NOTAMs — what was current when the release was signed, kept with the flight.",
          "Risk assessment — the FRAT, scored against the operator's own thresholds.",
          "Duty In confirmation — confirm the current duty period before acceptance.",
          "Accept or Deny Release — the assigned pilot records their decision after the preceding reviews.",
          "Flight Following Position Reports — review the position-report process and dispatch links.",
          "Post-Flight Log — after arrival, open and finish the flight’s draft log.",
        ],
      },
    ],
    connectsTo:
      "The preflight reads the dispatch packet and the manifest, and writes the acceptance back to the flight. A filed flight log pushes hours to Maintenance and settles the flight's pay events on Payroll. Currency comes from the compliance records, not from the logbook.",
    example:
      "The assigned pilot opens their 06:40 to PABE, reviews the existing dispatch release and preflight checks, then records acceptance. Pilot acceptance does not replace the dispatcher's release.",
    related: ["/flight-crew/elog", "/compliance/crew-currency", "/dispatch"],
  },
  {
    route: "/flight-crew/elog",
    title: "Electronic flight log",
    whoCanUse: ["pilot", "check_airman", "chief_pilot", "exec_admin"],
    whatItDoes:
      "The logbook entry for a flight: out, off, on, in, the hours that fall out of them, and the legs flown. Filing it is what turns a completed flight into hours on an airframe, time in a pilot's record, and settled pay events.",
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
          "The flight's pay events update from your legs and flight type: a medevac or training flight earns its modifier here.",
          "The entry joins your flight history, which is what a currency check reads.",
          "A chief pilot review is queued where the operator requires one.",
        ],
      },
    ],
    connectsTo:
      "Hours flow to Maintenance's time clock and to Payroll. Reviews appear in the chief pilot's review queue. The entry itself is part of the 135.63 record.",
    example:
      "A pilot lands at PAKN, enters 14:02 / 14:19 / 15:38 / 15:47, and the log returns 1:45 block and 1:19 flight. The airframe's next inspection moves by 1:45 without anyone updating it by hand.",
    related: ["/flight-crew/history", "/flight-crew/elog/cp-reviews", "/maintenance/due-list"],
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
    related: ["/compliance/crew-currency", "/compliance/type-qualifications", "/settings/bases"],
  },
  {
    route: "/compliance/type-qualifications",
    title: "Aircraft qualifications",
    whoCanUse: [
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
      "dispatcher",
      "check_airman",
      "pilot",
      "crew_member",
    ],
    whatItDoes:
      "The positions each pilot is authorised to fly on each aircraft type — PIC, SIC, Instructor, Check Airman and Advisory Pilot — and whether each is current. A position is current while the check rides on its type are in date, so \"who can take the Caravan as PIC tomorrow\" has a one-look answer.",
    howToUse: [
      "Scan for red first — an authorised position whose check ride is overdue or not on file.",
      "Hover a position to see when it was authorised and when its checks fall due.",
      "Open a pilot to authorise or revoke a position, or to record a check ride on a type.",
    ],
    sections: [
      {
        heading: "What makes a position current",
        steps: [
          "Every position needs a competency check (135.293) on the type within the last 12 calendar months.",
          "PIC also needs an instrument check (135.297) on the type within the last 6 calendar months.",
          "A check taken in the month before it is due, the month it is due or the month after keeps its anniversary month. One taken earlier or later starts a new anniversary from the month it was taken.",
          "The colours are the GOM's currency levels: green current, gold due this month, red the grace month (still flyable, but the check is overdue), magenta past the grace month or no check on file, grey nothing on record.",
        ],
      },
      {
        heading: "Who changes what",
        body: "A Chief Pilot, Director of Operations or Exec Admin authorises and revokes positions. A revoked position stays in the pilot's history with who revoked it and why. A check ride is a currency sign-off, so a Check Airman can record one as well.",
      },
      {
        heading: "Recording a check ride",
        body: "A check ride is logged once, against the pilot's competency or instrument check, naming the aircraft type it was flown in. The same entry moves the crew currency board and the type's positions. A failed check is kept on record and renews nothing.",
      },
      {
        heading: "At release",
        body: "Release checks the PIC against this grid once the Director of Operations or an Exec Admin switches aircraft qualifications on in Settings → Currency. It ships off, so the grid can be entered first. When on, a PIC who isn't current as PIC on the aircraft's type is refused, unless a Chief Pilot, Director of Operations or Exec Admin records an override for that flight. A check in its grace month is a warning the dispatcher acknowledges. Each release records the PIC's standing on the type and whether the check was on.",
      },
    ],
    connectsTo:
      "Types come from the aircraft records in the fleet. Check rides are currency completions, so they show on the crew currency board too. The roster's Aircraft column lists the positions each pilot may fly today.",
    example:
      "A check airman flies a Caravan competency check with a pilot and records the pass on the pilot's page. The pilot's Caravan SIC position turns green at once; their Caravan PIC position stays red until an instrument check on the Caravan is recorded too.",
    related: ["/compliance/roster", "/compliance/crew-currency", "/crew"],
  },
  {
    route: "/crew",
    title: "Crew calendar",
    whoCanUse: [
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
      "dispatcher",
      "check_airman",
      "pilot",
      "crew_member",
    ],
    whatItDoes:
      "A month of flight crew grouped by home base, showing who is assigned where, on which aircraft type, and for which days: flying, training, standby, off, ferry or check. A Chief Pilot, Director of Operations or Exec Admin edits it; everyone else reads it.",
    howToUse: [
      "Use the arrows to change month, and the base buttons to see one base: a pilot shows there if they are based there or assigned there.",
      "Click an empty day to add an assignment for that pilot from that day, or use Add Assignment. Flying, ferry and check need an aircraft type; a tail is optional.",
      "Click an assignment to change its days, base, type or duty, or to remove it.",
      "Move beside a name changes that pilot's home base.",
      "Day tags sit on the thin line under each pilot. Pick a tag above the grid, then click a day or drag across days to paint it; the Eraser clears instead, and right-clicking a painted day clears it too.",
      "Add a tag with + Tag; Manage renames, recolours, archives or restores one.",
    ],
    worthKnowing: [
      "A pilot holds one assignment on any day. Saving one that overlaps another is refused, and the message names the one already there.",
      "Bases come from Settings → Bases and types from the fleet, so a new base or type has to exist there first.",
      "Archiving a tag takes it off the palette but keeps every day already painted with it, so the past schedule doesn't change.",
      "Once aircraft qualifications are switched on, an assignment on a type the pilot holds no current position on is outlined in red, and hovering it says why. It's a warning, not a refusal: rostering ahead of a check ride is normal, and release is where it's enforced.",
    ],
    connectsTo:
      "Home base is the same field as the employee record's station. The Roster page is the currency matrix, by base.",
    related: ["/compliance/roster", "/settings/bases", "/employees"],
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
      "What's waiting to be signed back into service: Required Inspection Items waiting for their inspector, squawks whose work order is finished, grounding squawks with the work still to do, and every aircraft held.",
    howToUse: [
      "Sign off airworthy with the work performed, your name and your FAA certificate. It returns the aircraft to service straight away, unless it's an RII.",
      "Tick RII for a Required Inspection Item. The aircraft stays held until someone else inspects it and signs: the person who did the work can't.",
      "An inspector can reject the work, with a reason. It goes back to open, and stays an RII.",
      "Defer under the MEL, or as a DMI with a due date, instead of fixing it now. A DMI goes on the aircraft's due list and grounds it if the date passes.",
    ],
    connectsTo:
      "An aircraft is held by what the release reads: grounding squawks, expired MEL items, and overdue inspections and due items. Clearing the last one makes it available to Dispatch again.",
    example:
      "The 208B's generator is replaced at 16:00. The mechanic signs it as an RII, and it stays held. A second mechanic inspects it at 16:20 and signs, and it's on the board for the morning.",
    related: ["/maintenance/squawks", "/maintenance/work-orders", "/maintenance/availability"],
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
    route: "/maintenance/due-list",
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
    route: "/maintenance/mx-clock",
    title: "Maintenance clock",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "The time an aircraft spends in maintenance. A clock runs from Begin Work to Complete, with the mechanics on it and the milestones reached along the way.",
    howToUse: [
      "Pick the aircraft, and its work order if it has one, and press Begin Work. You go on the clock.",
      "Other mechanics press Join, and Leave when they're done. One aircraft has one clock at a time.",
      "Press each milestone as it's reached: Aircraft Pulled, Inspection Started, Parts Installed, Test Run Complete, Ready for RTS.",
      "Press Complete when the job's finished. Returning the aircraft to service is a separate sign-off, on the RTS Queue.",
    ],
    connectsTo:
      "The hours are what the availability report counts as time the aircraft couldn't fly.",
    example:
      "The 208B goes in for a 100-hour at 08:00. Two mechanics are on the clock, and it's completed at 16:00: eight hours off the fleet's availability this month.",
    related: ["/maintenance/availability", "/maintenance/rts", "/maintenance/work-orders"],
  },
  {
    route: "/maintenance/inventory",
    title: "Parts inventory",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "What parts are held, at which base, and how many, with each batch or lot at each base as its own line. A quantity reads red at or below its minimum, counting what's on its way to it. Every movement is recorded, so the history adds up to what's on the shelf.",
    howToUse: [
      "Search, or filter by base, category or low stock. Open a part to see its history and its shipments.",
      "Move stock on the part's page: Receive when it arrives, Issue when it's used, Return when it comes back. Name the aircraft or work order an issue goes to, because Batch Trace reads that.",
      "Barcode Scan finds a part by its code and checks one in or out. It lists each batch of a part number, soonest to expire first.",
      "Edit a part to correct it. A changed quantity goes in the history as a stock count.",
    ],
    connectsTo:
      "An expired part can't be issued, and an issue can't take more than is on hand. Expiry dates feed the expiration report, and issues feed Batch Trace.",
    worthKnowing: [
      "A line is stock at one base. Shipping moves stock between bases line to line, and what's on its way counts toward the receiving line's low stock, so a base with a shipment coming isn't told to reorder.",
    ],
    related: ["/maintenance/shipping", "/maintenance/parts-requests", "/maintenance/expiration", "/maintenance/batch-trace"],
  },
  {
    route: "/maintenance/shipping",
    title: "Parts shipping",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Parts on their way to a base, from another base or from a vendor, with the airway bill, carrier and expected arrival. Stock moves line to line: a shipment between bases leaves the sending base's stock when it's entered and joins the receiving base's when it arrives.",
    howToUse: [
      "Between bases: pick the stock it's leaving, the base it's going to and the quantity, then Ship It. The quantity comes off the sending base now.",
      "From a vendor: pick the stock it's for and the vendor, as ordered or shipped. Nothing moves until it arrives.",
      "Mark a shipment in transit when it's handed over, and Arrived with the day it came in: its stock is received at the destination then, on a new line if that base held none.",
      "Cancel a shipment entered by mistake: stock between bases goes back to the sender.",
    ],
    connectsTo:
      "The parts' own lines in Inventory, which show their shipments, and Parts Requests, whose shipments are entered here and fulfil the request when they arrive.",
    worthKnowing: [
      "Installing a part is an issue to the aircraft in Inventory, not a shipment status: the issue records which aircraft it went on, which Batch Trace reads.",
      "Expired stock, or more than is on hand, can't be shipped.",
    ],
    example:
      "PABE sends 4 oil filters to PADQ by Everts with AWB 1234. Bethel's count drops to 6 at once; Kodiak's line shows 2 on hand and 4 on the way, so it isn't flagged low. When they land, Mark Arrived puts them on Kodiak's shelf.",
    related: ["/maintenance/parts-requests", "/maintenance/inventory", "/maintenance/vendors"],
  },
  {
    route: "/maintenance/parts-requests",
    title: "Parts requests",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "One base asking another for a part. The request names the stock wanted, so the base holding it decides: approve, deny with a reason, then ship it. Open requests list AOG first, then urgent.",
    howToUse: [
      "Pick the stock (the list shows each base's count), the quantity, the base asking and the priority, then Send Request.",
      "The sending base approves it, or denies it and says why.",
      "Ship It on an approved request enters the shipment: the stock leaves the sending base, and the request is fulfilled when the shipment arrives.",
    ],
    connectsTo: "Shipping, where its shipment appears, and Inventory, whose counts it moves.",
    worthKnowing: ["A request can be withdrawn until it ships. A cancelled shipment puts its request back to approved, ready to ship again."],
    related: ["/maintenance/shipping", "/maintenance/inventory"],
  },
  {
    route: "/maintenance/inspections",
    title: "Inspections",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "An inspection of one aircraft (annual, 100-hour, progressive and the rest) and its checklist by section, with live progress. A failed item opens a squawk on the aircraft, and the inspection is finished by a sign-off with the signer's certificate.",
    howToUse: [
      "New Inspection: pick the aircraft, type and title. Its total time is taken when it starts.",
      "Add the checklist items by section, then mark each Pass or Fail. Failing says what was found: it becomes a squawk on the aircraft, fixed and returned to service the usual way.",
      "When every item has passed or its squawk is resolved, the inspection is ready to sign off: the signer, certificate and total time, and the due-list item it satisfies.",
    ],
    connectsTo:
      "Squawks, which a failed item opens and which show the inspection they came from, and the due list, where a sign-off records the item done and moves its next due.",
    worthKnowing: [
      "An item reads corrected once its squawk is resolved; there's no separate corrected button.",
      "An annual is signed by an IA. The form says so if another certificate is picked.",
      "An unchecked item can be removed and an inspection cancelled; a checked item stays on the record.",
    ],
    example:
      "N207GE's annual has 40 items. The left main tyre fails worn to the cords, which opens a grounding squawk. Once the tyre is changed and the squawk resolved, the item reads corrected, the IA signs the annual off at 4,210.4 hours, and the due list moves the next annual a year on.",
    related: ["/maintenance/due-list", "/maintenance/squawks", "/maintenance/rts"],
  },
  {
    route: "/maintenance/vendors",
    title: "Vendors",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "The shops and suppliers maintenance works with: MROs, parts suppliers, avionics, engine, prop, paint and interior shops, with a contact, phone, email and FAA certificate for each.",
    howToUse: [
      "Add Vendor, then fill in what you have. Only the name is needed.",
      "Edit a vendor to update it, or remove it from the list. Records that name it keep the name.",
    ],
    connectsTo: "Inspections done by a vendor name it, and a shipment from a vendor names who sent it.",
    related: ["/maintenance/inspections", "/maintenance/shipping"],
  },
  {
    route: "/maintenance/roster",
    title: "Mechanic roster",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Who in maintenance works which days: a month per mechanic, by base, with one day tag a day such as ON, OFF or TRN. The same day tags as the crew calendar, with a palette of their own.",
    howToUse: [
      "Pick a tag from the palette, then press and drag across a mechanic's days to paint them. Enter or Space paints the focused day.",
      "Pick the eraser, or right-click a day, to clear it.",
      "Add a tag with + Tag; rename, recolour or archive tags under Manage. Archiving keeps the days already painted.",
    ],
    worthKnowing: [
      "Mechanics are staff with the Maintenance or Director of Maintenance role, or in the maintenance department, by their home base.",
    ],
    related: ["/maintenance/mx-clock", "/crew"],
  },
  {
    route: "/maintenance/expiration",
    title: "Parts expiration",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Parts past their expiry date, and those expiring in the next 30, 60 and 90 days. Separate from the maintenance due list on purpose: that one is about airframes accruing hours, this one is about stock going out of date on a shelf whether or not anything flies.",
    howToUse: [
      "Read the expired list first. Those parts can't be issued, so take them off the shelf.",
      "Check quantities before ordering: an expiring part you hold six of is a different problem from one you hold one of.",
    ],
    connectsTo: "Reads the expiry dates recorded against inventory.",
    related: ["/maintenance/inventory", "/maintenance/batch-trace", "/maintenance/due-list"],
  },
  {
    route: "/maintenance/batch-trace",
    title: "Batch and lot traceability",
    whoCanUse: ["maintenance", "director_of_maintenance", "exec_admin"],
    whatItDoes:
      "Every movement of a batch or lot, and every aircraft that received a part from it. For an airworthiness directive or a recall.",
    howToUse: [
      "Enter a batch number, a lot number or both, or part of one.",
      "The table lists each movement. Affected Aircraft Summary lists the aircraft to look at.",
    ],
    connectsTo:
      "Reads what was issued from inventory. A part issued without naming an aircraft shows no aircraft here.",
    related: ["/maintenance/inventory", "/maintenance/expiration"],
  },
  {
    route: "/maintenance/availability",
    title: "Aircraft revenue availability",
    whoCanUse: ["maintenance", "director_of_maintenance", "dispatcher", "chief_pilot", "exec_admin"],
    whatItDoes:
      "How much of a period each aircraft could have flown, and what it did with it: revenue hours, maintenance hours, non-revenue flying and idle time. Green at 90%, yellow at 75%, red below.",
    howToUse: [
      "Pick the dates. It starts with the last 30 days, least available aircraft first.",
      "Read the status for where each aircraft stands now: In MX, RTS Hold or Available.",
    ],
    connectsTo:
      "Maintenance hours come from the Maintenance Clock, so time nobody clocked counts as available. Flight hours come from filed logs' block times, or else the check-in times, and a log's flight type decides what's non-revenue.",
    related: ["/maintenance/mx-clock", "/maintenance/rts", "/maintenance"],
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
      "Safety reports come from the floating Safety button on every page, and the safety team registers hazards from them here. Triaged hazards feed corrective actions and the safety dashboard. Safety Intelligence reads the same reports to look for patterns across them.",
    example:
      "A ramper reports a fuel truck parked inside the wing line at PABE. The safety officer triages it as minor severity but occasional likelihood, raises a corrective action to repaint the stand markings, and closes it after a spot check two weeks later shows trucks stopping short.",
    related: ["/safety/reports", "/safety/incidents", "/safety/actions", "/ai/safety-intelligence"],
  },
  {
    route: "/safety/reports/new",
    title: "Filing a safety report",
    whoCanUse: ["pilot", "crew_member", "maintenance", "ground_ops", "dispatcher", "reservations_agent", "safety_officer", "chief_pilot", "check_airman", "director_of_maintenance", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Reports anything that worried you: a safety concern, a near miss, a fatigue concern, an ASAP report, a suggestion. The red Safety button in the corner of every page comes straight here and remembers where you were, so a report can be filed from wherever the thing was noticed.",
    howToUse: [
      "Pick the report type and the date it happened.",
      "Give it a short title, then describe what you saw, not what you concluded.",
      "Add where, the flight and the tail if they apply, and a photo or PDF if you have one.",
      "Submit. You can follow it under My Reports.",
    ],
    worthKnowing: [
      "Severity and likelihood are optional. Give your best guess if you have one; the safety team sets the final assessment when they review the report.",
      "Filed anonymously, your name is hidden from everyone reviewing the report except the Safety Officer and Exec Admins. You can still see the report under My Reports.",
      "An ASAP report is seen only by the Safety Officer, the Director of Operations and Exec Admins. It carries your name: ASAP is confidential, not anonymous.",
    ],
    connectsTo:
      "A filed report lands in the safety team's Safety Reports inbox, alerts them in the notification bell, and appears in your own My Reports list.",
    related: ["/safety/mine", "/safety/reports"],
  },
  {
    route: "/safety/reports",
    title: "Safety reports",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Every report filed with the red Safety button, newest first, with its status and its risk: severity times likelihood on the 5×5 matrix, high at 15 and above, medium at 8.",
    howToUse: [
      "Filter by status to find what has not been looked at yet.",
      "Open a report to review it: set the status, assign it to someone on the safety team, and set or revise severity and likelihood.",
      "Write the resolution, which the person who filed it can read.",
      "Raise a corrective action from the report where one is needed.",
    ],
    worthKnowing: [
      "ASAP reports are not shown to a chief pilot: they are the Safety Officer's, the Director of Operations' and Exec Admins'.",
      "An anonymous report says only \"Anonymous\" in the list. On the report itself the Safety Officer and Exec Admins see who filed it; nobody else does.",
    ],
    connectsTo:
      "Filed from the red Safety button. A new report alerts the safety team in the notification bell until somebody moves it on from Open. Corrective actions raised here appear on the CAPA board, and the counts feed the safety dashboard.",
    related: ["/safety/reports/new", "/safety/actions", "/safety/dashboard"],
  },
  {
    route: "/safety/asap",
    title: "ASAP program",
    whoCanUse: ["safety_officer", "director_of_operations", "exec_admin"],
    whatItDoes:
      "The Aviation Safety Action Program: every ASAP report, the Event Review Committee's decision on each, and the company's FAA MOU. ASAP gives the reporter protection under the MOU in exchange for coming forward, so the ERC's decision on each report is the record that matters.",
    howToUse: [
      "Read the pending reports first: each needs the ERC to meet on it.",
      "File the ERC review under the report: the meeting date, who sat on it, the decision and why, and the corrective action or feedback to the reporter.",
      "Tick de-identified once the report has been stripped of who filed it, before it goes any further inside the company.",
      "Keep the current MOU in the document library under the category \"ASAP MOU\" so it shows here.",
    ],
    worthKnowing: [
      "ASAP reports and their reviews are seen only by the Safety Officer, the Director of Operations and Exec Admins, plus the person who filed the report.",
      "An ASAP report can't be filed anonymously. ASAP is confidential, not anonymous: the ERC has to be able to reach the reporter.",
      "A decision closes the case on the review date it was recorded for. Moving it back to pending reopens it.",
    ],
    connectsTo:
      "ASAP reports are filed with the red Safety button, as ASAP Report. The same reports appear in Safety Reports for the safety team, where corrective actions are raised.",
    related: ["/safety/reports", "/safety/reports/new", "/documents"],
  },
  {
    route: "/safety/report",
    title: "Filing a hazard",
    whoCanUse: ["safety_officer", "chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Registers a hazard in the safety team's hazard register, usually from something a safety report raised. Reports from the rest of the operation come in through the red Safety button instead.",
    howToUse: [
      "Describe the hazard, not the event that showed it up.",
      "Say where.",
      "Record any immediate action taken.",
      "File it, then triage it from Safety SMS.",
    ],
    connectsTo:
      "A filed hazard appears in the Safety SMS triage inbox.",
    related: ["/safety", "/safety/reports"],
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
      "Actions are raised from safety reports, hazard reports and incidents. Open counts feed the safety dashboard.",
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
    connectsTo: "Aggregates safety reports, hazard reports, incidents and corrective actions.",
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
      "Read each lesson and pass its attached quiz, if present, then select Mark Complete.",
      "The course completes after every lesson is marked complete; its certificate and completion date are then recorded.",
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
      "Where courses are built: lessons with text, pictures, videos, PDFs and SCORM modules, ordering, and optional quizzes attached to individual lessons. This is the authoring side of Academy, separate from taking a course.",
    howToUse: [
      "Create the course and describe what completing it means.",
      "Add lessons in the order a learner should meet them.",
      "Under a lesson, use + Add to upload a picture, video, PDF or SCORM package (.zip), paste a YouTube or Vimeo link, or pick a document from the library. Preview shows it as a learner will see it; a SCORM preview counts for nothing.",
      "Use Attach Quiz on a lesson, edit its questions, and set the pass threshold. Add questions before learners take it.",
      "To start from the company's own manual, use Draft lessons from a document under the lessons: pick the document, how many lessons and whether to add a quiz, and the drafts come back in a minute or two. Keep the ones you want; each ends with the pages it came from.",
      "Publish, then assign it from the assignments page.",
    ],
    worthKnowing: [
      "A video has to be watched and a PDF paged to the end before its lesson can complete or its quiz opens, unless you untick that for a reference document. A quiz also waits for the earlier lessons.",
      "Drafted lessons are written only from the document's pages, and are yours to check and edit: on a published course they show to learners as soon as they are added. Each person can draft ten times an hour.",
      "PowerPoint slides need saving as a PDF first. A SCORM 1.2 or 2004 package (.zip, one SCO) can be added like any file: it plays in the lesson and records status and score, and passed or completed counts as finished.",
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
      "Review the selected learners before assigning. This form does not set a due date.",
      "Track completion from the same page.",
    ],
    connectsTo: "Reads the published course catalogue and creates enrollments. Learners must complete the lessons before a completion is recorded.",
    related: ["/academy/studio", "/academy/reports", "/compliance/crew-currency"],
  },
  {
    route: "/academy/reports",
    title: "Academy reports",
    whoCanUse: ["chief_pilot", "director_of_operations", "exec_admin"],
    whatItDoes:
      "Training across the company in five reports: completion by employee, by course and by department, overdue training, and training currency. Each can be filtered and exported as CSV.",
    howToUse: [
      "Pick a report from the tabs: By Employee, By Course, By Department, Overdue Training or Training Currency.",
      "Narrow it with the filters it offers (dates, department, role, base or one person), then press Filter. Clear starts over.",
      "Export CSV downloads the report with the same filters.",
    ],
    worthKnowing: [
      "Training is overdue when the certificate from someone's latest completion of a course has run out. Assignments have no due date, so nothing is overdue before a first completion.",
      "Pass rate counts the learners who passed a course's quiz out of those who took it, and the average score is each learner's best on each quiz. A course without a quiz has neither.",
      "From and To narrow completions and quiz scores; assigned and overdue are as of today. Only published courses and current staff are counted.",
    ],
    connectsTo:
      "Reads the enrollments, quiz attempts and certificates that assignments and learners create. Training Currency covers the courses whose certificate expires.",
    related: ["/academy/assignments", "/academy/certificates", "/academy/studio"],
  },
  // ── Your own records ────────────────────────────────────────────────
  {
    route: "/safety/mine",
    title: "My safety reports",
    whatItDoes:
      "The reports you have filed, and what happened to them. It exists because a reporting culture depends on reporters seeing that something came of it — a report that vanishes teaches people not to file the next one.",
    howToUse: [
      "Open a report to see where the safety team has got to with it.",
      "Read the resolution, which is where they record what came of it.",
    ],
    connectsTo: "Your reports, as reviewed by the safety team, with the resolution they wrote.",
    related: ["/safety/reports/new", "/safety"],
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
      "The courses assigned to you, what is outstanding, and what you have completed. Approved linked training may satisfy a currency item; a general course completion alone does not establish flight eligibility.",
    howToUse: [
      "Start with anything overdue — some of it holds up a currency item.",
      "Read each lesson, watch its videos and page through its PDFs to the end, pass its attached quiz if it has one, and select Mark Complete.",
      "Passing a quiz does not mark the lesson complete. Mark every lesson complete to finish the course and issue its certificate.",
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
    route: "/schedule/master",
    title: "Master Schedule",
    whoCanUse: ["dispatcher", "exec_admin"],
    whatItDoes:
      "Holds the flights the company flies every week, each with its days of the week, in named schedules such as Winter 2026. Publishing one to a date range puts its flights on the Schedule without building them one by one.",
    howToUse: [
      "Create a schedule, then add each flight with its route, aircraft, times and days.",
      "Enter a date range under Publish to Date Range and press Preview to see what it would add.",
      "Press Publish. A publication made by mistake can be withdrawn from Publication History.",
    ],
    connectsTo:
      "Published flights are ordinary flights on the Schedule: crewed on the dispatch packet, booked, released and flown like any other. Other roles can read this page; only dispatch and an Exec Admin can change it.",
    related: ["/schedule", "/dispatch", "/flight-following"],
  },
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
    related: ["/schedule/master", "/dispatch", "/flight-following", "/reservations/fleet-board"],
  },
  {
    route: "/manifest",
    title: "Manifest",
    whoCanUse: ["dispatcher", "reservations_agent", "ground_ops", "pilot", "exec_admin"],
    whatItDoes:
      "Who and what is on the aircraft: passengers, their weights, and cargo. These feed the weight check on the release. The app does not calculate CG or check a balance envelope: when the flight's ForeFlight plan comes back, a weight or the CG outside its limits there holds the release; otherwise use the approved aircraft loading procedure for balance.",
    howToUse: [
      "Open the flight's manifest, and create it if the flight has none.",
      "Add passengers and crew with actual or standard weights, as the operator's policy requires, and their bags.",
      "Add USPS mail by class, and cargo with its weight. A UPS package is a cargo line with its tracking number.",
      "Check the weight left for mail and freight: the aircraft's useful load less the crew, the fuel (dispatch's planned figure, or else the trip's estimate from the type's burn rate) and everything on board.",
      "Load what is waiting for the route: the manifest suggests mail and freight to fill the weight left, priority mail first, and loads it in one click. What doesn't fit stays waiting.",
      "Lock the manifest when boarding closes. Before departure, the same authorized roles can use Reopen to change the load; reopening is audited and re-locking runs the checks again. Ground Ops, Reservations Agents, Dispatchers, the Chief Pilot, the Director of Operations and Exec Admins can lock and reopen.",
    ],
    connectsTo:
      "Feeds the dispatch packet's weight and balance, and the preflight step the pilot signs. Passenger counts come from the booking where there is one.",
    related: ["/dispatch", "/reservations", "/flight-crew", "/manifest/waiting"],
  },
  {
    route: "/manifest/waiting",
    title: "Mail & freight waiting",
    whoCanUse: ["ground_ops", "reservations_agent", "dispatcher", "exec_admin"],
    whatItDoes:
      "Mail and freight on hand at each station before it is on a flight. Each flight's manifest shows what is waiting for its route and suggests filling the weight left with it.",
    howToUse: [
      "Log what comes in: the station it is at, where it is going, the USPS class or that it is cargo, its weight and its pieces.",
      "Open a flight's manifest to see what is waiting for its route, and load the suggestion there.",
      "Remove an entry that goes another way. Loading part of an entry leaves the rest of it waiting.",
    ],
    connectsTo:
      "Feeds each flight's load plan on its manifest. Taking a loaded line off a manifest puts its weight back here.",
    related: ["/manifest"],
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
      "Each airport shows its runway and the crosswind from the latest report, on the best-aligned runway. Runways come from the FAA's airport file, or from Stations where one has been entered. Report where the wind is from as a compass point, N, NE, E, SE, S, SW, W or NW: it's compared with the runway's number.",
    ],
    connectsTo: "Station observations, the same source the per-flight briefings draw on. The same crosswind goes into the risk matrix and the FRAT.",
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
      "Chase any completed flight without a filed log — until it is filed, its pay stands on the check-in times, without any medevac or training modifier.",
      "Close the day once the list is clear.",
    ],
    connectsTo:
      "Reads the day's flights and their logs. Unfiled logs are what hold up a flight's final hours and pay events.",
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
    related: ["/maintenance/due-list", "/profitability", "/ai/query"],
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
      "Use the Onboarding tab for the checklists assigned to them and what's still required before they start.",
      "Use the Drug & Alcohol tab for their tests and whether they're cleared for safety-sensitive duty.",
    ],
    worthKnowing: [
      "Exec Admin only, and deliberately: the record carries a date of birth, a home address and an emergency contact. That is also why an employee cannot currently open their own record.",
    ],
    connectsTo:
      "The certificate record is the same 135.63 record the compliance profile shows. Required documents are defined once in Settings and appear on everyone they apply to.",
    related: ["/employees/onboarding", "/employees/drug-alcohol", "/settings/document-requirements", "/compliance/crew-currency", "/payroll"],
  },
  {
    route: "/employees/onboarding",
    title: "Onboarding",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot", "director_of_maintenance", "safety_officer"],
    whatItDoes:
      "Every new hire's onboarding: the checklist assigned to them, how much is done, what's overdue and what's still required before they start. Each task is due a number of days after the hire date.",
    howToUse: [
      "Assign a Checklist: pick the new hire, the checklist, and the supervisor their Supervisor tasks fall to. Leave the hire date blank to use the one on their record.",
      "Open a hire to work their tasks: Done, Started, Skip with a reason, or Reopen. A Document Upload task is done by uploading its document.",
      "Use the views for onboarding that's complete or archived. Archive one that was assigned by mistake; Bring Back restores it.",
    ],
    connectsTo:
      "The tasks are copied from the checklist when it's assigned, so a later edit to the checklist doesn't change a hire already under way. Uploaded documents are filed in the employee's Documents.",
    worthKnowing: [
      "A task required before starting is shown here, on the employee's record and in Settings → Users. It doesn't block switching their login on.",
      "HR tasks fall to whoever runs onboarding, IT tasks to the Executive Admins, Manager tasks to the Exec Admin, Director of Operations, Chief Pilot and Director of Maintenance.",
    ],
    related: ["/employees/onboarding/checklists", "/employees/onboarding/my-tasks", "/employees"],
  },
  {
    route: "/employees/onboarding/checklists",
    title: "Onboarding checklists",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot", "director_of_maintenance", "safety_officer"],
    whatItDoes:
      "The checklists a company builds for its new hires, such as New Hire Pilot or New Hire Ramp Agent: ordered tasks, each with a type, who it falls to and how many days after the hire date it's due.",
    howToUse: [
      "Create a checklist with its name and the role it's for, then add its tasks.",
      "For each task pick its type and who does it: the new hire, their supervisor, HR, IT, a manager or a specific role. A Document Upload task names the document it files.",
      "Move tasks up and down to set their order. Duplicate a checklist to start a similar one; archive one that's no longer used.",
    ],
    connectsTo:
      "Document Upload tasks file under the document requirements set in Settings → Document Requirements. Assigning a checklist happens on Onboarding or on the employee's record.",
    worthKnowing: [
      "Removing or changing a task changes the checklist for hires assigned it from then on. Hires already under way keep the tasks they were given.",
    ],
    related: ["/employees/onboarding", "/settings/document-requirements"],
  },
  {
    route: "/employees/onboarding/my-tasks",
    title: "My onboarding tasks",
    whatItDoes:
      "The onboarding tasks that fall to you, across every new hire, soonest due first: your own as a new hire, a supervisor's for their hires, or those of your role. They also appear in Waiting on you on Home.",
    howToUse: [
      "Mark a task Done, Started, or Skip it with a reason. Open a hire to see the rest of their checklist.",
      "For a Document Upload task, choose the file and its dates, then Upload & File. It's filed in the employee's Documents.",
    ],
    worthKnowing: ["A task you've done leaves the list. Whoever runs onboarding can reopen it if it needs doing again."],
    related: ["/employees/onboarding", "/home"],
  },
  {
    route: "/employees/drug-alcohol",
    title: "Drug & Alcohol Testing",
    whoCanUse: ["exec_admin", "director_of_operations", "chief_pilot", "director_of_maintenance", "safety_officer"],
    whatItDoes:
      "The company's DOT drug and alcohol testing program (14 CFR 120, 49 CFR 40). The program's Designated Employer Representative (DER), the alternate DER and the Exec Admins see everything: the year's random testing rates, who isn't cleared for safety-sensitive duty and why, who's waiting on a random test, and tests waiting on a result. The Director of Operations, Chief Pilot, Director of Maintenance and Safety Officer see who's cleared, yes or no, and who the DER is.",
    howToUse: [
      "Name the DER on the Program tab first; until then only the Exec Admins can open the program.",
      "Make random selections on the Random Pool tab, then enter each test from the person's page.",
      "Open someone from Not Cleared to see why, and what clears them.",
    ],
    worthKnowing: [
      "Cleared means a negative pre-employment drug test on file (taken no more than 180 days before their hire date) and not removed from duty: a positive or a refusal clears with a negative return-to-duty test, an alcohol result of 0.02 to 0.039 when the DER returns them at their next duty period, never sooner than 8 hours after the test.",
      "Test results are confidential (49 CFR 40.321). The leaders, Settings → Users and Home show only that someone isn't cleared, never why.",
      "With the release check on (Program tab), release refuses a PIC or SIC who isn't cleared.",
    ],
    related: ["/employees/drug-alcohol/pool", "/employees/drug-alcohol/report", "/employees/drug-alcohol/program", "/employees/drug-alcohol/my-tests"],
  },
  {
    route: "/employees/drug-alcohol/pool",
    title: "Random testing pool",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The safety-sensitive employees subject to random testing, and the random selections. For the program's DER, the alternate DER and the Exec Admins.",
    howToUse: [
      "Everyone holding one of the program's safety-sensitive roles is in the pool. Change someone to add them, or leave them out (on leave, say) with the reason, and set their FAA category if their role doesn't say it.",
      "Draw a selection here: pick drug, alcohol or both and how many. Or enter the list your consortium drew.",
      "Open a selection, record when you tell each person, then enter their test. Excuse someone with the reason.",
    ],
    worthKnowing: [
      "A draw keeps the pool it was drawn from and its seed: the same seed over the same pool picks the same people, which shows the draw was fair. Everyone in the pool is equally likely each time.",
      "Random tests are unannounced, so FlightOps doesn't tell anyone they've been drawn. Once told, they go straight to the collection site.",
    ],
    related: ["/employees/drug-alcohol", "/employees/drug-alcohol/program"],
  },
  {
    route: "/employees/drug-alcohol/report",
    title: "Annual MIS report",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The DOT MIS Data Collection form (DOT F 1385) for a calendar year, the annual reports of 14 CFR 120.119 (drug) and 120.219(b) (alcohol), due 15 March for the year before. One form per FAA employee category, filled in from the year's tests.",
    howToUse: [
      "Pick the year. Enter any results still pending first: they aren't counted.",
      "Copy the figures into the DOT's MIS system, or give them to your consortium.",
      "Once the year is over, certify it with the certifying official's name. If a test changes later, the report says so.",
    ],
    worthKnowing: [
      "Part 121 carriers, and other operators with 50 or more safety-sensitive employees on 1 January, file every year; others when the FAA asks.",
      "Covered employees and the random rate are measured against the average of the year's selection pools (14 CFR 120.109(b)(6)); random positives, negatives and refusals count toward the rate, cancelled tests don't.",
    ],
    related: ["/employees/drug-alcohol", "/employees/drug-alcohol/program"],
  },
  {
    route: "/employees/drug-alcohol/collectors",
    title: "Collectors, MROs and labs",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "The collection sites, Medical Review Officers, laboratories and consortiums the company's tests name, with their contacts and after-hours numbers.",
    howToUse: ["Add each one you use; pick them when entering a test.", "Switch one off when you stop using it: tests that name it keep it."],
    related: ["/employees/drug-alcohol"],
  },
  {
    route: "/employees/drug-alcohol/program",
    title: "Drug and alcohol program settings",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Who the DER and the alternate DER are, the random testing rates, the roles in the random pool, and what the MIS form's employer section says. Also the switch that holds the release for a pilot who isn't cleared.",
    howToUse: [
      "Name the DER and an alternate: with the Exec Admins, they see the results and run the program.",
      "Keep the rates at or above the FAA's minimums: 25% for drugs and 10% for alcohol in 2026.",
      "Turn the release check on once everyone's tests are entered. The Director of Operations or an Exec Admin can.",
    ],
    related: ["/employees/drug-alcohol", "/settings/currency"],
  },
  {
    route: "/employees/drug-alcohol/my-tests",
    title: "My drug and alcohol tests",
    whatItDoes:
      "Your own drug and alcohol tests, their documents, and whether you're cleared for safety-sensitive duty, with why not.",
    howToUse: [
      "Open a test's documents, such as the custody and control form, from its row.",
      "Ask the DER, named at the top, about any test or why you aren't cleared.",
    ],
    worthKnowing: ["A random selection you're on isn't shown here: random tests are unannounced, and the DER tells you when to go."],
    related: ["/employees/drug-alcohol"],
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
      "The hours are recorded here. Clocking out makes a pay event for them, pending on Payroll; hours past 40 in the week, Monday to Sunday, become overtime, except for flight crew. A corrected shift corrects its event.",
    related: ["/payroll", "/payroll/periods"],
  },
  {
    route: "/payroll",
    title: "Payroll",
    whoCanUse: ["exec_admin"],
    whatItDoes:
      "Pay events and the periods they roll into. Flights that land and shifts that clock out make their own events; others are entered by hand. Each is approved or rejected before it can export.",
    howToUse: [
      "Choose the period's dates, then review its events. A note in the description means someone should look: Approve all pending leaves those for you.",
      "Press Bring up to date after changing pay rates, or for flights and shifts from before the rates were set.",
      "Investigate anything without a source rather than adjusting it.",
      "Lock the period when it is agreed, then export.",
    ],
    sections: [
      {
        heading: "Where a pay event comes from",
        steps: [
          "A flight landing: flight pay for the PIC and SIC, the day's rate, and any modifiers, from Settings → Pilot Pay. With no rate, the hours are still recorded.",
          "Filing the flight log: its legs replace the check-in times, and its flight type decides the medevac and training modifiers.",
          "A shift clocking out: duty hours, and overtime past 40 in the week, Monday to Sunday. Flight crew have no hourly overtime: their hours are on record only.",
          "A manual entry on Payroll, which carries whoever entered it. Nothing automatic changes it. Per diem, standby, training pay, expenses and deductions are entered this way.",
        ],
      },
    ],
    connectsTo:
      "A locked period exports for the payroll provider, approved events only. Settings → Pilot Pay keeps the rate table a flight's events read. An event already exported doesn't change: a later correction is a new event for the next export.",
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
    whoCanUse: ["exec_admin", "director_of_operations", "accountant"],
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
    whoCanUse: ["exec_admin", "director_of_operations", "accountant"],
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
    whoCanUse: ["exec_admin", "director_of_operations", "accountant"],
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
      "The company's pay rate table and daily modifiers: what a pilot earns, by airframe and years of service. A flight's pay events read them when it lands.",
    howToUse: [
      "Add a rate: daily or flight hourly, for all pilots or one, narrowed by airframe or years of service if you pay that way.",
      "To change a rate, add a new one with a later effective date.",
      "Add a modifier for what pays extra, such as a medevac flight or a night arrival.",
    ],
    worthKnowing: [
      "Rates and modifiers are added and removed, not edited.",
    ],
    connectsTo: "Payroll doesn't read these yet: pay events are entered by hand on Payroll.",
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
      "Enter the weights and limits carefully; the weight check uses them. The app does not calculate CG or the balance envelope from these fields.",
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
    whoCanUse: ["exec_admin", "director_of_operations"],
    whatItDoes:
      "The operator's own subscription to this platform: the plan, the seats, the billing dates and the invoices for it, as Stripe holds them, including a failed payment and what is still due. Distinct from Invoicing, which is what the operator bills its own customers.",
    howToUse: [
      "Read the plan, the seats and the next billing date. A failed payment shows here with the amount due.",
      "Change the plan or seats, update the card, or cancel, under Manage billing (Stripe's Customer portal). Choose plan appears only when there is no live subscription, so the company is never charged twice.",
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
      "Open a station to see the FAA's runway figures for it. With nothing entered, the risk matrix uses those. Enter a runway only to score the stop on a different one, or to correct them.",
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
    related: ["/ramp-ops", "/ground-ops", "/safety/reports/new"],
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
