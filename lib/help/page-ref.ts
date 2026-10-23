import { DEPARTMENTS } from "@/components/app-shell/modules";

import { helpFor } from "./catalogue";

/**
 * The page a question is asked from (#114), as Peregrine Assistant is
 * told it: the route, and its name as its help article or the nav names
 * it. "How do I do this?" on the dispatch packet means the packet.
 */

const NAV_LABELS = new Map(
  DEPARTMENTS.flatMap((d) => d.children)
    .filter((c) => c.href)
    .map((c) => [c.href as string, c.label]),
);

export function pageRef(pathname: string): { route: string; title?: string } {
  const title = helpFor(pathname)?.title ?? NAV_LABELS.get(pathname);
  return title && title !== pathname ? { route: pathname, title } : { route: pathname };
}
