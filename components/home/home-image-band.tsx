import type { ReactNode } from "react";

/**
 * The company's image behind Home's greeting and today's figures (#118).
 *
 * The client, 26 Oct: "at least the home page should paint the background
 * as the specific companies' imagery. Maybe this can be pulled from the
 * company's specific websites home page." Set under Settings → Branding;
 * a company without one keeps the plain Home Greg chose on 20 Oct.
 *
 * As the sign-in page's photograph is drawn: a dark island in both modes,
 * under a scrim so the type on it reads. The image is the company's own
 * link on any host, so it's a plain <img> rather than next/image (which
 * would need every host configured); one that fails to load leaves the
 * band dark.
 */
export function HomeImageBand({ src, children }: { src: string; children: ReactNode }) {
  return (
    <section className="dark relative overflow-hidden bg-ink text-foreground">
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
      <div className="relative mx-auto max-w-6xl px-4 pb-2 pt-24 sm:px-8 sm:pt-40">{children}</div>
    </section>
  );
}
