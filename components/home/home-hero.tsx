import { HomeBrandMark, HomeWordmark } from "./home-brand";

/** Hero surface for the /home landing.
 *
 *  Structure (three stacked bands, all full-width):
 *    1. Light-gray secondary header (#f2f2f2) — wordmark left, page title right
 *    2. Photo hero — dark overlay + aircraft photo, big greeting + live counters
 *    3. Ops-line strip — 24/7 phone + primary CTA
 *
 *  Palette:
 *    Accent red    #AB2429  — primary
 *    Accent dark   #8f1e22  — hover
 *    Band gray     #f2f2f2
 *
 *  Hero photo lives at /public/images/home-hero.jpg. Fallback dark
 *  gradient renders if the asset is missing.
 */
export function HomeHero({
  tenantName,
  greeting,
  firstName,
  airborne,
  onGround,
  acftHold,
}: {
  tenantName: string;
  greeting: string;
  firstName?: string | null;
  airborne: number;
  onGround: number;
  acftHold: number;
}) {
  return (
    <>
      {/* Light-gray secondary header — full width */}
      <div className="border-b border-black/[0.06] bg-[#f2f2f2]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <HomeWordmark size={40} />
          <div className="hidden text-right sm:block">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[#AB2429]">
              Flight Operations
            </div>
            <div className="mt-0.5 text-lg font-light text-[#1a1a1a]">
              Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Photo hero — dark overlay from left (heavy) to right (light) so
          the headline stays legible and the aircraft on the right side
          of the photo remains visible. Fallback gradient in the same
          color family shows if the asset is missing. */}
      <div
        className="relative overflow-hidden bg-cover bg-center"
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
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#ff6b6f]">
                {greeting}
                {firstName ? ` · ${firstName}` : ""}
              </p>
              <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-md sm:text-[3rem]">
                {tenantName}
              </h1>
              <p className="mt-4 text-sm font-medium italic text-white/70">
                &ldquo;Fly Easy, Fly Grant&rdquo;
              </p>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-white/80">
                Here&apos;s your fleet right now. Every module below is one click
                away — Reservations, Dispatch, Maintenance, Flight Following,
                and more.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <HeroStat value={airborne} label="Airborne" tone="green" />
              <HeroStat value={onGround} label="On ground" tone="amber" />
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

      {/* Ops-line contact strip — sits between the hero and Departments */}
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#AB2429]/10 text-[#AB2429]">
              <SmallPlane />
            </span>
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Ops Line
              </div>
              <div className="text-sm font-semibold text-neutral-900">
                +1 (555) 000-0000 · 24/7
              </div>
            </div>
          </div>
          <a href="tel:+15550000000" className="btn-home-primary">
            Call ops
          </a>
        </div>
      </div>

      {/* Button styles scoped to /home — matches the pitch-skin's rounded
          rectangular buttons. Local <style> because we don't want to touch
          the app-wide button tokens. */}
      <style>{`
        .btn-home-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.625rem 1.25rem;
          border-radius: 0.375rem;
          background: #AB2429;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: background-color 0.15s ease;
          border: 1px solid #AB2429;
        }
        .btn-home-primary:hover {
          background: #8f1e22;
          border-color: #8f1e22;
        }
        .btn-home-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.625rem 1.25rem;
          border-radius: 0.375rem;
          background: #ffffff;
          color: #AB2429;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: background-color 0.15s ease;
          border: 1px solid #AB2429;
        }
        .btn-home-secondary:hover {
          background: rgba(171, 36, 41, 0.06);
        }
      `}</style>
    </>
  );
}

function HeroStat({
  value,
  label,
  tone,
  muted,
}: {
  value: number;
  label: string;
  tone: "green" | "amber" | "red";
  muted?: boolean;
}) {
  const color = { green: "#34d399", amber: "#fbbf24", red: "#f87171" }[tone];
  return (
    <div className="flex min-w-[80px] flex-col items-start rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 backdrop-blur-md">
      <span
        className="text-[2.25rem] font-bold leading-none tabular-nums"
        style={{ color: muted ? "rgba(255,255,255,0.3)" : color }}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/80">
        {label}
      </span>
    </div>
  );
}

function SmallPlane() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}
