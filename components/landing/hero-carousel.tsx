"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

import type { Slide } from "./content";

/** ForeFlight's hero holds each slide for about eight seconds (#78). */
export const SLIDE_MS = 8000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    // Absent outside a browser (and in old ones): treat as no preference.
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The full-bleed hero (#78), as ForeFlight's: photographs cross-fading
 * behind left-aligned UPPERCASE copy over a left-to-right scrim. The slide
 * markers sit under the copy, on its left edge, where ForeFlight centres
 * its dots: one column to read down.
 *
 * And what a carousel owes everyone: it pauses while the pointer or focus
 * is on it and for good with the Pause control; the markers and the arrow
 * keys move it; it does not move at all for anyone who asked for reduced
 * motion; a screen reader hears a slide change only while it is paused
 * (an auto-advancing live region would talk over everything else).
 */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const reduced = usePrefersReducedMotion();
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const playing = !paused && !holding && !reduced;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, go]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Peregrine Flight Ops"
      className="dark relative h-[min(680px,92svh)] min-h-[540px] w-full overflow-hidden bg-ink"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div aria-live={paused ? "polite" : "off"}>
        {slides.map((slide, i) => {
          const current = i === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!current}
              className={cn(
                "absolute inset-0 transition-opacity ease-out",
                reduced ? "duration-0" : "duration-[1200ms]",
                current ? "opacity-100" : "opacity-0",
              )}
            >
              <Image
                src={slide.photo.src}
                alt={slide.photo.alt}
                fill
                sizes="100vw"
                priority={i === 0}
                className="object-cover"
                style={{ objectPosition: slide.photo.position }}
              />
              {/* The scrim: ForeFlight's left-to-right fade from the chrome,
                  there for the type's sake; a ceiling for the transparent
                  nav, which bright skies took to 2:1; a floor for the
                  markers. */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-transparent" />
              <div aria-hidden className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-ink/80 to-transparent" />
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/70 to-transparent" />
              <div className="relative mx-auto flex h-full max-w-[1180px] items-center px-5 sm:px-8">
                <div className="max-w-[35rem] pb-10 pt-20">
                  <p className="text-balance font-display text-[2.4rem] font-extrabold uppercase leading-[1.06] tracking-[0.02em] text-white sm:text-[3.4rem]">
                    {slide.title}
                  </p>
                  <p className="mt-5 max-w-[32rem] text-[1.0625rem] leading-[1.7] text-white/90">{slide.lead}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* One set of actions for every slide, so nothing focusable hides
          inside a slide that is not showing. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="mx-auto flex h-full max-w-[1180px] items-end px-5 pb-28 sm:px-8 sm:pb-24">
          <div className="pointer-events-auto flex flex-wrap gap-3">
            <Link href="/login" className={buttonSolid}>
              Sign in
            </Link>
            <a
              href="#platform"
              className="btn-caps inline-flex items-center rounded-md border-2 border-white/80 px-4 py-[0.4rem] text-white transition-colors hover:bg-white hover:text-chrome"
            >
              See the platform
            </a>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 pb-8 sm:px-8">
          <div className="flex items-center gap-2" role="group" aria-label="Choose a slide">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}: ${slide.title}`}
                aria-current={i === index ? "true" : undefined}
                className="group relative h-6 w-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-white/35 group-hover:bg-white/60" />
                {i === index ? (
                  <span
                    key={`${index}-${playing}`}
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 top-1/2 h-[3px] origin-left -translate-y-1/2 bg-white",
                      playing && "animate-ff-progress",
                    )}
                  />
                ) : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {paused ? "Play" : "Pause"}
          </button>
        </div>
      </div>
    </section>
  );
}
