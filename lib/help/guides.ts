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
    slug: "create-and-assign-training",
    title: "Create a lesson and assign training",
    roles: ["chief_pilot", "director_of_operations", "exec_admin"],
    summary: "Build a course with a lesson and optional knowledge check, then assign it to learners.",
    steps: [
      "Open [Course studio](/academy/studio), choose **New Course**, enter its title, description, category and certificate validity, and select **Create Course**. It starts as a draft.",
      "Under **Add a lesson**, enter the lesson title and text, then select **Add Lesson**. Repeat for additional lessons in the order learners should read them.",
      "For a knowledge check, select **Attach Quiz** on the lesson. In the quiz editor, save its title and pass threshold, then add questions, answer options and the correct answer. Return to the course in Studio.",
      "Leave **Linked currency item** at **No link** for a demonstration or general training exercise. Only link approved training to an eligible currency item when that training actually satisfies it.",
      "Set **Publish status** to **Published** and save. In [Training assignments](/academy/assignments), choose the course and learners and assign it. Confirm their enrollments appear.",
      "Have the learner complete the course using [Complete Academy training](/help#guide-complete-academy-training), then verify the completion in Assignments and [Certificates](/academy/certificates).",
    ],
    notes: [
      "Lessons hold text, pictures, videos and PDFs, and optional quizzes. A video has to be watched and a PDF paged to the end before the lesson completes or its quiz opens, unless the author marks it as reference. SCORM playback and Academy aggregate reports/CSV export are not available. Assignments and Certificates show the underlying records.",
      "Peregrine Assistant can explain these steps. It cannot author a course, assign a learner, grade an answer or record completion for you.",
    ],
    pages: ["/academy/studio", "/academy/assignments", "/academy/certificates"],
  },
  {
    slug: "complete-academy-training",
    title: "Complete Academy training",
    roles: ["pilot", "crew_member", "maintenance", "ground_ops", "chief_pilot", "director_of_operations", "exec_admin"],
    summary: "Finish each lesson and verify the resulting completion record and certificate.",
    steps: [
      "Open [My Training](/academy/mine) and continue the assigned course. A published course can also be opened from [Academy](/academy) and enrolled in.",
      "Read the lesson, watch its videos and page through its PDFs to the end. Skipping ahead in a video is off until it has been watched. If a quiz is attached, it opens after that, once the earlier lessons are complete: answer and submit it. A failed attempt does not complete the lesson; review the feedback and retry.",
      "After a passing attempt, select **Mark Complete** on the lesson. Passing the quiz alone does not complete it. Repeat for every lesson.",
      "Confirm the course shows **Completed** and its completion date. Open **Certificates** in Academy, select the issued certificate, and return to My Training to verify the completed record persists.",
    ],
    notes: [
      "A certificate records the Academy course completion. A general course with no compliance link does not grant regulatory currency or operational qualification.",
      "The assistant explains the workflow but cannot see your live enrollment, answer the assessment for you or mark training complete.",
    ],
    pages: ["/academy/mine", "/academy"],
  },
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
      "Enter the passengers and cargo. Tick **Flown IFR** if the flight will be flown IFR; left unticked, it is a VFR flight. Then press **Open Flight**.",
    ],
    notes: [
      "A VFR flight isn't released while the weather at any stop is below the company's dispatch minimums. To change VFR or IFR later, open the flight on Dispatch and press **Edit**.",
      "A flight can't carry more passengers than the aircraft's passenger seats (Settings → Fleet). Crew don't count.",
      "Times are typed and shown in the departure base's local time.",
      "Bookings waiting for a flight are listed under **Awaiting a flight** on Dispatch.",
      "To change the route later, move it to another day or cancel the flight, see [Pull back, move or cancel a flight](/help#guide-pull-back-or-cancel-a-flight).",
    ],
    pages: ["/dispatch", "/flight-following/new"],
  },
  {
    slug: "publish-the-master-schedule",
    title: "Publish the master schedule",
    roles: ["dispatcher", "exec_admin"],
    summary: "Put the flights you fly every week on the Schedule without building each one.",
    steps: [
      "On [Schedule](/schedule), press **Master Schedule**, then **+ New Schedule**. Give it a name, for example Winter 2026. A company can keep one for each season.",
      "Press **+ Add Flight**. Enter the flight number, the aircraft, where it leaves from and where it goes, and tick the days it operates. It is built as on + New Flight: a round trip by default, with the times filled in from the aircraft's cruise speed. Add one for each flight.",
      "Under **Publish to Date Range**, enter the start and end dates and press **Preview**. It says how many flights the dates would add and which can't be added, and why.",
      "Press **Publish**. The flights are on the [Schedule](/schedule) with status Planned, ready to crew and release like any other flight.",
    ],
    notes: [
      "Times are the clock at the departure base, and hold through a clock change: the 9 am flight stays the 9 am flight.",
      "A flight number already on a date is left as it is, so a flight moved or cancelled on the day stays that way, and publishing the same dates again adds nothing twice.",
      "An aircraft can't hold two flights at once, so a flight is not added when its aircraft is already on another at that time. The preview names it. A flight on an inactive aircraft isn't added either, nor one whose time has already gone today.",
      "Changing a schedule doesn't change flights already published. Change those on the day from the flight's panel on the Schedule.",
      "A publication made by mistake can be taken back: **Withdraw** in Publication History removes its flights, except any that have been crewed, booked, released or changed. The same dates can then be published again.",
      "Crew are assigned to each flight on the dispatch packet, as with any flight.",
    ],
    pages: ["/schedule/master", "/schedule"],
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
      "Under **FRAT**, check the pilot has signed, and sign as the dispatcher. A HIGH risk, or a FRAT over company limits, waits for the Chief Pilot or DO to approve it. **Weight and balance** beside it shows the load the release is judged on: the manifest's, or the passengers and cargo typed on the flight.",
      "Your acknowledgments (currency warnings, MEL items, NOTAMs, old weather) are saved as you tick them, with your name and the time: only your own count toward your release.",
      "Press **Generate PDF**, read the confirmation, then **Release & generate**. The flight is released, the pilot sees the release, and the dispatch packet opens.",
    ],
    notes: [
      "Peregrine checks the weight; it doesn't calculate the CG. A ForeFlight plan that comes back with a weight or the CG outside its limits holds the release; without one, verify balance using the approved aircraft loading procedure before release. An AI answer does not replace that check.",
      "A refused release says why next to the button. Every reason, and how it is cleared, is in [Why won't my flight release?](/help#faq-release-refused).",
      "The packet keeps the weather, risk and AAWU charts as they were at release, so printing it later shows what the flight was released on.",
      "To take a release back before departure, see [Pull back, move or cancel a flight](/help#guide-pull-back-or-cancel-a-flight).",
    ],
    pages: ["/dispatch"],
  },
  {
    slug: "file-a-frat",
    title: "File a FRAT",
    roles: ["pilot", "chief_pilot", "check_airman", "dispatcher"],
    summary: "Dispatch scores the flight's risk and signs it; the pilot reviews it and signs at preflight step 1, before the release.",
    steps: [
      "Open the flight's FRAT: **Open FRAT ›** on the dispatch packet, **FRAT** in the flight's panel on [Schedule](/schedule), or **FRAT ›** beside the flight on [Flight Crew](/flight-crew). There is one FRAT per flight; dispatch files it for the PIC once the flight is built.",
      "Score each factor from 0 to 5 in its group: pilot, aircraft, environment, external and route. Ceiling, visibility and wind come filled in from the route's METARs, FAA WeatherCams and village reports (the worst current reading at each stop), with the source named, and icing and turbulence from the official PIREPs near the route. Weather used that isn't certified is marked, with the OpSpecs notice. Change any score that doesn't match what you see.",
      "Note how you will mitigate anything scored high, and submit. The total sets the level, against your company's thresholds (Settings → Flight Risk): LOW, MEDIUM, HIGH or EXTREME.",
      "Sign it: dispatch signs first, on the FRAT or the dispatch packet, once the flight is built: a PIC on the crew, an airworthy aircraft and a load within its useful load. Then the pilot sees each factor's score at preflight step 1 and signs it there. Each records the name and time; the pilot's also records their flight minutes flown and left for the day.",
      "Over company limits, or at EXTREME, or with the dispatch packet scoring the flight HIGH, the Chief Pilot or the Director of Operations approves it from their own login; they have a bell alert.",
      "The flight can't be released until both have signed. Each is told under **Waiting on you**, in the bell and on Home, when it's their turn. The signed FRAT, with its audit trail ID, prints as a PDF and with the flight packet.",
    ],
    notes: [
      "The pilot can change a score. A change starts from the scores on file and makes a new version, so both signatures clear: dispatch signs it again, then the pilot. Once the flight is released the FRAT stays as signed; dispatch pulls the release back to change it.",
      "In the preflight the FRAT is step 1: the pilot signs it there, after dispatch, before the release.",
      "For a VFR flight, an aircraft not IFR certified, or a field without an instrument approach, weather below the company's dispatch minimums scores 5: over company limits.",
      "On an IFR flight the FRAT asks whether the forecast ceiling and visibility at arrival are at or above the approach minimums, from your approach plates. A no scores that factor 5: below them the flight may not take off IFR (14 CFR 135.219), and a carried block FRAT doesn't apply, since each leg answers for its own landings.",
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
    title: "Pull back, move or cancel a flight",
    roles: ["dispatcher", "exec_admin"],
    summary: "Change, take back, move to another day or call off a flight.",
    steps: [
      "Open the flight's packet on [Dispatch](/dispatch).",
      "Before it is released: **Edit** changes the route, stops and times, and **Cancel Flight** calls it off, with an optional reason.",
      "After it is released, before it departs: **Pull back release** returns it to scheduled. Give the reason. The pilot's release and acceptance no longer count, and the flight has to be released again.",
      "Or cancel the released flight, giving the reason.",
      "To fly it on another day, before it departs: **Move to Another Day** and pick the day. Every leg keeps its local time, and its bookings, manifest, mail and freight, crew and fuel orders stay on it. A released flight needs a reason, and the move takes its release back.",
    ],
    notes: [
      "A flight moved to another day needs its FRAT filed and signed again, the pilot's preflight, fresh acknowledgments and a release, and anyone checked in is booked again. Tell the passengers and the crew: nothing is sent to them.",
      "Cancelling puts the flight's bookings back on Awaiting a flight. A passenger added on the manifest with no booking has to be rebooked by hand: the Cancel window names them.",
      "A flight its pilot returned over weight stays on Dispatch until the load is re-planned: take the weight off on its manifest, then **Mark Re-planned** on its card. The pilot's preflight is held until then.",
      "A cancelled flight stays on record as cancelled: nothing is deleted.",
      "A flight that has departed can't be pulled back or moved.",
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
