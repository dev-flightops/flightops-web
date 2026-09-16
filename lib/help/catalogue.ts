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
    const body = [
      entry.whatItDoes,
      ...entry.howToUse,
      entry.connectsTo ?? "",
      ...(entry.worthKnowing ?? []),
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
