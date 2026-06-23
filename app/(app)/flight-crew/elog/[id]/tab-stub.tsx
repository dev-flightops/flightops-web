import { TAB_LABELS, type TabKey } from "./tabs";

/**
 * Placeholder shown on tabs whose underlying data model doesn't ship
 * with this PR. Each stub names what's coming so a pilot poking at
 * the page understands why a tab is empty rather than feeling like
 * something broke.
 */
export function TabStub({
  tab,
  description,
}: {
  tab: Exclude<TabKey, "info">;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {TAB_LABELS[tab]}
      </h2>
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center">
        <p className="text-xs font-semibold text-muted-foreground">
          Coming soon
        </p>
        <p className="mx-auto mt-2 max-w-md text-[0.7rem] text-muted-foreground/80">
          {description}
        </p>
      </div>
    </div>
  );
}
