import { Button } from "@/components/ui/button";

import { HomeWordmark } from "./home-brand";

/** The home page's opening — the design the whole app now shares.
 *
 *  Three full-width bands:
 *    1. Brand band — the muted ground, wordmark left, page title right
 *    2. Photo hero — an ink island over the aircraft photo: greeting,
 *       the operator's name, and the live fleet counters
 *    3. Ops line — the tenant's ops phone and a call button, shown only
 *       when their company profile has one
 *
 *  Built on tokens throughout. It used to carry ~50 hardcoded colour
 *  literals and its own button styles in a scoped <style> block, which is
 *  why none of it reached any other page.
 *
 *  Hero photo: /public/images/home-hero.jpg. A dark gradient in the same
 *  family shows if the asset is missing.
 */
export function HomeHero({
  tenantName,
  wordmark,
  wordmarkSubtitle,
  greeting,
  firstName,
  airborne,
  onGround,
  acftHold,
  opsPhone,
}: {
  tenantName: string;
  /** First word of the tenant's name, upper-cased, for the wordmark. */
  wordmark?: string;
  /** The rest of the name, in the small line beneath. */
  wordmarkSubtitle?: string;
  greeting: string;
  firstName?: string | null;
  airborne: number;
  onGround: number;
  acftHold: number;
  /** From the company profile. The strip is omitted when unset rather
   *  than showing a placeholder number — which is what it used to do,
   *  with +1 (555) 000-0000 hardcoded for every tenant. */
  opsPhone?: string | null;
}) {
  return (
    <>
      <div className="border-b border-border bg-muted">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <HomeWordmark
            size={40}
            wordmark={wordmark}
            subtitle={wordmarkSubtitle}
          />
          <div className="hidden text-right sm:block">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary">
              Flight Operations
            </div>
            <div className="mt-0.5 text-lg font-light text-foreground">
              Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Ink island over the photo: tokens inside resolve to the dark
          palette, so the counters get the dark-tuned status colours and
          the eyebrow gets the brand's on-ink tone. The overlay runs heavy
          on the left so the headline stays legible and the aircraft on
          the right of the photo stays visible. */}
      <div
        className="dark relative overflow-hidden bg-cover bg-center text-foreground"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(10,10,15,0.88) 0%, rgba(10,10,15,0.55) 45%, rgba(10,10,15,0.25) 100%), " +
            "url('/images/home-hero.jpg'), " +
            "linear-gradient(135deg, #2b1a1e 0%, #1a1214 50%, #0a0508 100%)",
          backgroundColor: "#0a0508",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-brand-light">
                {greeting}
                {firstName ? ` · ${firstName}` : ""}
              </p>
              <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground drop-shadow-md sm:text-[3rem]">
                {tenantName}
              </h1>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/80">
                Here&apos;s your fleet right now. Every module below is one
                click away — Reservations, Dispatch, Maintenance, Flight
                Following, and more.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <HeroStat value={airborne} label="Airborne" tone="green" />
              <HeroStat value={onGround} label="On ground" tone="yellow" />
              <HeroStat
                value={acftHold}
                label="Acft hold"
                tone="red"
                muted={acftHold === 0}
              />
            </div>
          </div>
        </div>
      </div>

      {opsPhone ? (
        <div className="border-b border-border bg-background">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SmallPlane />
              </span>
              <div>
                <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ops line
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {opsPhone} · 24/7
                </div>
              </div>
            </div>
            <Button asChild size="lg">
              <a href={`tel:${opsPhone.replace(/[^0-9+]/g, "")}`}>Call ops</a>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const TONE = {
  green: "text-status-green",
  yellow: "text-status-yellow",
  red: "text-status-red",
} as const;

function HeroStat({
  value,
  label,
  tone,
  muted,
}: {
  value: number;
  label: string;
  tone: keyof typeof TONE;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-[80px] flex-col items-start rounded-xl border border-foreground/15 bg-background/40 px-4 py-3.5 backdrop-blur-md">
      <span
        className={
          "text-[2.25rem] font-bold leading-none tabular-nums " +
          (muted ? "text-muted-foreground" : TONE[tone])
        }
      >
        {value}
      </span>
      <span className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-foreground/80">
        {label}
      </span>
    </div>
  );
}

function SmallPlane() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}
