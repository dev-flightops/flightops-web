import type { Metadata } from "next";

import { SLIDES } from "@/components/landing/content";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { LandingNav } from "@/components/landing/landing-nav";
import {
  CapabilitiesSection,
  ClosingBand,
  IntroSection,
  LandingFooter,
  LoadBand,
  OperationsSection,
} from "@/components/landing/landing-sections";

export const metadata: Metadata = {
  title: "Peregrine Flight Ops — Part 135 operations platform",
  description:
    "Dispatch, flight following and compliance for Part 135 operators: releases, crew, weather, maintenance, load planning and the records an inspector asks for.",
};

/**
 * `/` — the public landing page (#78), in ForeFlight's manner: a full-bleed
 * photographic hero, then the platform section by section. Signed-out
 * visitors only; the proxy sends a signed-in user to their home.
 */
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <h1 className="page-title sr-only">Peregrine Flight Ops</h1>
        <HeroCarousel slides={SLIDES} />
        <IntroSection />
        <OperationsSection />
        <LoadBand />
        <CapabilitiesSection />
        <ClosingBand />
      </main>
      <LandingFooter />
    </>
  );
}
