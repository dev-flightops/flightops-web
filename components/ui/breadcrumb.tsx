import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Compact breadcrumb used as the page-eyebrow on detail pages. Pattern:
 *
 *   <Plane /> Operations · [Dispatch] · GV101
 *
 * Each segment is either a Link (when a href is provided) or plain text.
 * The first item gets a leading icon to anchor the row visually.
 *
 * Sized to match the legacy department-row chip style — 0.65rem uppercase
 * with .08em tracking.
 */
export interface BreadcrumbSegment {
  label: string;
  /** When present, the segment renders as a Link; otherwise as a span. */
  href?: string;
}

export interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  icon?: ReactNode;
  className?: string;
}

export function Breadcrumb({ segments, icon, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 text-muted-foreground",
        className,
      )}
    >
      {icon && (
        <span className="inline-flex h-3.5 w-3.5" aria-hidden>
          {icon}
        </span>
      )}
      {segments.map((segment, index) => (
        <span key={`${segment.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
          )}
          {segment.href ? (
            <Link
              href={segment.href}
              className="text-[0.65rem] font-bold uppercase tracking-[0.08em] hover:text-status-blue"
            >
              {segment.label}
            </Link>
          ) : (
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em]">
              {segment.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
