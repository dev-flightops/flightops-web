import Image from "next/image";
import Link from "next/link";

import { buttonSolid, linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

import { BAND_PHOTO, CAPABILITIES, DEPARTMENTS, FOOTER_COLUMNS, PHOTO_CREDITS } from "./content";
import { Wordmark } from "./wordmark";

/**
 * The landing page's sections (#78), ForeFlight's templates with
 * Peregrine's content: a centred head over a photo mosaic on the band
 * colour, a product section with a real screenshot, a full-bleed photo band
 * with a scrim, capabilities as captioned rows, a closing band, and the
 * dark footer. ForeFlight's 120px rhythm, a 1180px column.
 */

const COLUMN = "mx-auto max-w-[1180px] px-5 sm:px-8";
const LEAD = "text-[1.0625rem] leading-[1.7] text-muted-foreground";

/** ForeFlight's "Solutions for every flight": the band, a centred head, and
 *  the departments as photographs — square-cornered and of different
 *  sizes, not four identical rounded cards. */
export function IntroSection() {
  return (
    <section id="platform" className="band scroll-mt-20 py-24 sm:py-28">
      <div className={COLUMN}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="section-title text-foreground">One system for the whole operation</h2>
          <p className={cn(LEAD, "mt-4")}>
            From the reservation to the invoice, every department works the same flight, and the platform
            checks the parts a person should not have to remember.
          </p>
        </div>
        <div className="mt-14 grid gap-3 sm:h-[440px] sm:grid-cols-4 sm:grid-rows-2">
          {DEPARTMENTS.map((d, i) => (
            <a
              key={d.label}
              href={d.href}
              className={cn(
                "group relative block min-h-[200px] overflow-hidden bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                i === 0 && "sm:col-span-2 sm:row-span-2",
                i === 1 && "sm:col-span-2",
              )}
            >
              <Image
                src={d.photo.src}
                alt=""
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                style={{ objectPosition: d.photo.position }}
              />
              {/* A scrim under the caption only, so the photo keeps its colour. */}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
              <span className="caption-caps absolute bottom-5 left-5 right-5 text-white">{d.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** ForeFlight's "What's new": copy on the left, the product on the right —
 *  here the redesigned board itself, in whichever theme the page is in. */
export function OperationsSection() {
  return (
    <section id="operations" className="scroll-mt-20 bg-background py-24 sm:py-28">
      <div className={cn(COLUMN, "grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <div>
          <p className="eyebrow">Live operations</p>
          <h2 className="section-title mt-3 text-foreground">Every flight, followed</h2>
          <p className={cn(LEAD, "mt-5")}>
            The board shows every flight of the day: who is airborne, who is released and still on the
            ground, and who is overdue — with the times in local and in Zulu, and the positions your pilots
            report on the map beside it.
          </p>
          <p className={cn(LEAD, "mt-4")}>
            Mark a departure or an arrival from the row. The overdue alert is raised by the platform, not
            remembered by a dispatcher.
          </p>
          <Link href="/login" className={cn(linkCaps, "mt-7 text-[0.8125rem]")}>
            Sign in to the board <span aria-hidden>›</span>
          </Link>
        </div>
        <figure className="border border-border bg-card p-1.5">
          <Image
            src="/images/landing/product-board-dark.png"
            alt="The Flight Following board in the dark theme: flights with their aircraft, route, times and status"
            width={1600}
            height={1000}
            sizes="(min-width: 1024px) 680px, 100vw"
            className="theme-dark-only h-auto w-full"
          />
          <Image
            src="/images/landing/product-board-light.png"
            alt="The Flight Following board in the light theme: flights with their aircraft, route, times and status"
            width={1600}
            height={1000}
            sizes="(min-width: 1024px) 680px, 100vw"
            className="theme-light-only h-auto w-full"
          />
        </figure>
      </div>
    </section>
  );
}

/** ForeFlight's full-bleed photo band. The copy sits right on a wide
 *  screen, where this photo's aircraft is on the left; on a narrow one the
 *  copy covers the photo, so the scrim is even. */
export function LoadBand() {
  return (
    <section id="load" className="dark relative scroll-mt-20 overflow-hidden bg-ink">
      <Image
        src={BAND_PHOTO.src}
        alt={BAND_PHOTO.alt}
        fill
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: BAND_PHOTO.position }}
      />
      <div aria-hidden className="absolute inset-0 bg-ink/75 lg:bg-transparent lg:bg-gradient-to-l lg:from-ink/95 lg:via-ink/75 lg:to-transparent" />
      <div className={cn(COLUMN, "relative py-24 sm:py-32")}>
        <div className="max-w-xl lg:ml-auto">
          <p className="eyebrow text-white/80">Load planning</p>
          <h2 className="section-title mt-3 text-white">Mail, freight and passengers, planned to the pound</h2>
          <p className="caption-caps mt-4 text-white/85">The fuel worked out, the rest filled</p>
          <p className="mt-5 text-[1.0625rem] leading-[1.7] text-white/90">
            The manifest takes the crew, the passengers and the trip&apos;s fuel off the useful load, then
            suggests what of the waiting mail and freight fills what is left, priority classes first. What
            does not fit stays queued for the next flight.
          </p>
          <Link href="/login" className={cn(buttonSolid, "mt-8")}>
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/** ForeFlight's captioned feature rows: an UPPERCASE head over prose — no
 *  cards — with a short rule in the operator's colour above each. */
export function CapabilitiesSection() {
  return (
    <section className="bg-background py-24 sm:py-28">
      <div className={COLUMN}>
        <div className="max-w-2xl">
          <h2 className="section-title text-foreground">What the platform checks for you</h2>
          <p className={cn(LEAD, "mt-4")}>
            The rules an operation lives by, applied the same way on every flight, every day.
          </p>
        </div>
        <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title}>
              <span aria-hidden className="block h-0.5 w-8 bg-brand-ink" />
              <h3 className="caption-caps mt-5 text-foreground">{c.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-[1.7] text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingBand() {
  return (
    <section className="dark bg-chrome">
      <div className={cn(COLUMN, "flex flex-wrap items-center justify-between gap-6 py-14")}>
        <div>
          <h2 className="section-title text-white">Built for Part 135 operators</h2>
          <p className="mt-2 text-[1.0625rem] text-white/85">Sign in with your company account.</p>
        </div>
        <Link href="/login" className={buttonSolid}>
          Sign in
        </Link>
      </div>
    </section>
  );
}

/** ForeFlight's footer: dark, UPPERCASE column heads, quiet links. */
export function LandingFooter() {
  return (
    <footer className="dark bg-background">
      <div className={cn(COLUMN, "py-16")}>
        <div className="grid gap-10 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Dispatch, flight following and compliance for Part 135 operators.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>© 2026 Peregrine Flight Ops</p>
          <p>{PHOTO_CREDITS}</p>
        </div>
      </div>
    </footer>
  );
}
