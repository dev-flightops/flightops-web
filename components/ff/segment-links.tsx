import Link from "next/link";

import { segment, segmentGroup } from "./controls";

/**
 * A filter that is a set of links (#80): ForeFlight's segmented control, the
 * current choice filled. It replaces the rows of small bordered chips the
 * pages drew for "All bases · PABE · PADU …". Links, so a filter is a URL
 * and the page stays a server component.
 */
export function SegmentLinks({
  label,
  items,
  className,
}: {
  /** What is being chosen, for assistive technology ("Base"). */
  label: string;
  items: { href: string; label: string; active: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <div className={segmentGroup}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={segment(item.active)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
