import Link from "next/link";

import { tab, tabList } from "@/components/ff/controls";

/**
 * The program's own tabs, legacy's dat/_nav.html: Dashboard, Random Pool,
 * Collectors/MRO, Annual Report. Legacy's Testing Types and Result Codes
 * tabs aren't carried over: the MIS form fixes both lists. Program holds
 * what legacy kept at the top of its pool page.
 */

export type DatTab = "home" | "pool" | "collectors" | "report" | "program";

const TABS: { key: DatTab; label: string; href: string }[] = [
  { key: "home", label: "Dashboard", href: "/employees/drug-alcohol" },
  { key: "pool", label: "Random Pool", href: "/employees/drug-alcohol/pool" },
  { key: "collectors", label: "Collectors / MRO", href: "/employees/drug-alcohol/collectors" },
  { key: "report", label: "Annual MIS Report", href: "/employees/drug-alcohol/report" },
  { key: "program", label: "Program", href: "/employees/drug-alcohol/program" },
];

export function DatNav({ active }: { active: DatTab }) {
  return (
    <nav aria-label="Drug and alcohol program" className={`${tabList} mb-6`}>
      {TABS.map((t) =>
        t.key === active ? (
          <span key={t.key} aria-current="page" className={tab(true)}>
            {t.label}
          </span>
        ) : (
          <Link key={t.key} href={t.href} className={tab(false)}>
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}
