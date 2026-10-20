/**
 * The landing page's words and pictures (#78).
 *
 * Copy is Peregrine's own and names only what the platform does today.
 * The photographs are U.S. government works in the public domain, found on
 * Wikimedia Commons (each one's source is noted beside it); ForeFlight's
 * photography and copy are not used. They are a first pass, to be replaced
 * by the operator's own photography.
 *
 * The hero sets its copy on the left, over a scrim, so each slide's
 * subject sits centre-right; photos whose subject sits left go to the
 * tiles instead.
 */

export interface Photo {
  src: string;
  alt: string;
  /** object-position: where the subject sits, so a narrow screen keeps it. */
  position: string;
}

export interface Slide {
  id: string;
  /** UPPERCASE display title. */
  title: string;
  lead: string;
  photo: Photo;
}

export const SLIDES: Slide[] = [
  {
    id: "operations",
    title: "Part 135 operations, run as one",
    lead: "Dispatch, flight following and compliance for operators who fly the bush, from the first manifest of the morning to the last landing of the day.",
    // BLM Alaska: "BLM Alaska staff unload aircraft in Prudhoe Bay".
    photo: {
      src: "/images/landing/hero-ramp-2400.jpg",
      alt: "A turbine Otter on a snow-covered ramp at dusk while two crew unload cargo",
      position: "42% 60%",
    },
  },
  {
    id: "release",
    title: "Release with everything on record",
    lead: "Weather, crew currency, airworthiness and the risk assessment checked before a flight leaves, and kept for the day an inspector asks.",
    // BLM Alaska: "Instrument panel of single engine aircraft".
    photo: {
      src: "/images/landing/hero-cockpit-2400.jpg",
      alt: "The instrument panel and power levers of a single-engine turboprop",
      position: "60% 45%",
    },
  },
  {
    id: "villages",
    title: "Built for the way your bases fly",
    lead: "Village strips, mail and freight, passengers by weight. The load plan works out the trip's fuel and fills what is left from what is waiting.",
    // USFWS: "Kanuti National Wildlife Refuge floatplane facility at VOR
    // Lake in Bettles, Alaska".
    photo: {
      src: "/images/landing/hero-bettles-2400.jpg",
      alt: "A floatplane at a lakeside dock in Bettles, Alaska, beside a covered avgas tank",
      position: "50% 50%",
    },
  },
  {
    id: "following",
    title: "Every flight, followed",
    lead: "A live board of every aircraft, overdue alerts the moment they are due, and the positions your pilots report.",
    // USFWS (Courtney Celley): "U S Forest Service aircraft in flight".
    photo: {
      src: "/images/landing/hero-beaver-2400.jpg",
      alt: "A de Havilland Beaver in flight against a clear blue sky",
      position: "50% 50%",
    },
  },
  {
    id: "airworthy",
    title: "Airworthy, and provably so",
    lead: "Squawks, MEL deferrals and inspections tracked against the fleet, so a grounded aircraft never reaches a release.",
    // USFWS (Steve Hillebrand): "Aircraft hanger".
    photo: {
      src: "/images/landing/hero-hangar-2400.jpg",
      alt: "A tailwheel aircraft inside a clean, well-lit maintenance hangar",
      position: "50% 60%",
    },
  },
];

// USFWS: "Light float plane aircraft making a landing".
export const BAND_PHOTO: Photo = {
  src: "/images/landing/band-landing-2400.jpg",
  alt: "A floatplane touching down on a river, spray behind its floats",
  position: "50% 50%",
};

/** The departments, as the intro's photo mosaic shows them: a large
 *  tile, a wide one and two small (landing-sections.tsx). Decorative —
 *  each tile's label says what it is. */
export const DEPARTMENTS: { label: string; href: string; photo: Photo }[] = [
  {
    label: "Dispatch & release",
    href: "#platform",
    // USFWS: "Floatplane taxing down Kashunuk River".
    photo: { src: "/images/landing/tile-delta-2400.jpg", alt: "", position: "20% 50%" },
  },
  {
    label: "Flight following",
    href: "#operations",
    // USFWS (Lisa Hupp), Kodiak NWR: "Flying into Uganik Lake".
    photo: { src: "/images/landing/tile-uganik-2400.jpg", alt: "", position: "50% 70%" },
  },
  {
    label: "Mail, freight & passengers",
    href: "#load",
    // The first slide's ramp, closed in on the crew and the cargo.
    photo: { ...SLIDES[0].photo, alt: "", position: "100% 70%" },
  },
  {
    label: "Maintenance",
    href: "#platform",
    photo: { ...SLIDES[4].photo, alt: "" },
  },
];

export const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: "Dispatch release",
    body: "Every acknowledgment the packet collects, the risk matrix scored from live weather, and a release that refuses a pilot or an aircraft that is not legal.",
  },
  {
    title: "Crew and duty",
    body: "Currency, medicals and check rides tracked per pilot; duty days clocked against your limits, with a warning before the limit and not after it.",
  },
  {
    title: "Weather and risk",
    body: "METARs, TAFs and village weather against your company floor. Below it, the release is held and the reason recorded.",
  },
  {
    title: "Maintenance",
    body: "Squawks, work orders, MEL deferrals and inspections due, tied to the aircraft and to every release it is on.",
  },
  {
    title: "Safety",
    body: "Safety reports and ASAP, risk scored, with corrective actions that have an owner and a due date and are closed when done.",
  },
  {
    title: "Billing and records",
    body: "Invoices raised when a flight lands, manifests locked for the record, and an audit trail of who changed what.",
  },
];

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Dispatch & release", href: "#platform" },
      { label: "Flight following", href: "#operations" },
      { label: "Load planning", href: "#load" },
      { label: "Maintenance", href: "#platform" },
    ],
  },
  {
    title: "Operations",
    links: [
      { label: "Crew & duty", href: "#platform" },
      { label: "Weather & risk", href: "#platform" },
      { label: "Safety", href: "#platform" },
      { label: "Billing & records", href: "#platform" },
    ],
  },
  {
    title: "Account",
    links: [{ label: "Sign in", href: "/login" }],
  },
];

export const PHOTO_CREDITS =
  "Photography: Bureau of Land Management Alaska, U.S. Fish and Wildlife Service, National Park Service — public domain.";
