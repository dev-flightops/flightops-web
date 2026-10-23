import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { RichText } from "@/components/help/rich-text";
import { HELP_ENTRIES } from "@/lib/help/catalogue";
import { FAQ } from "@/lib/help/faq";
import { GUIDES, type Guide } from "@/lib/help/guides";
import { WORKFLOW } from "@/lib/help/workflow";
import { formatRole, type Role } from "@/lib/roles";

/**
 * Help (#114): how Peregrine works, job by job, on one page.
 *
 * The client asked for "a one-page overview of the full workflow from
 * booking to invoice", "short, step-by-step how-to guides ... organized
 * by role" and "a short troubleshooting / FAQ page". This is all three,
 * with an anchor on each guide and answer: /help#guide-release-a-flight,
 * /help#faq-release-refused. The help assistant links to those anchors,
 * and answers from the same text (lib/help/corpus.ts).
 *
 * The page articles stay in the ? panel, which opens on the page they
 * explain; this links to each from the foot.
 */

const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: "Dispatch", roles: ["dispatcher"] },
  { label: "Pilots", roles: ["pilot", "crew_member", "check_airman"] },
  { label: "Ground ops and reservations", roles: ["ground_ops", "reservations_agent"] },
  { label: "Maintenance", roles: ["maintenance", "director_of_maintenance"] },
  { label: "Managers and billing", roles: ["exec_admin", "director_of_operations"] },
];

function guidesFor(roles: Role[]): Guide[] {
  return GUIDES.filter((guide) => guide.roles.some((role) => roles.includes(role)));
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Help"
        description="How Peregrine works, job by job. Press ? at the top of any page for that page's help, or to ask a question."
      />

      <div className="space-y-6">
        <Panel title="From booking to invoice" id="workflow">
          <ol className="space-y-4">
            {WORKFLOW.map((stage, i) => (
              <li key={stage.slug} id={`workflow-${stage.slug}`}>
                <p className="text-sm font-semibold">
                  {i + 1}. {stage.title}
                </p>
                <p className="eyebrow mt-0.5">
                  {stage.who} ·{" "}
                  <Link href={stage.page} className="text-primary hover:underline">
                    {stage.page}
                  </Link>
                </p>
                <RichText text={stage.what} className="mt-1 text-sm text-muted-foreground" />
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Guides by role" id="guides">
          <div className="grid gap-5 sm:grid-cols-2">
            {ROLE_GROUPS.map((group) => (
              <section key={group.label}>
                <h3 className="eyebrow mb-1.5">{group.label}</h3>
                <ul className="space-y-1">
                  {guidesFor(group.roles).map((guide) => (
                    <li key={guide.slug}>
                      <Link
                        href={`#guide-${guide.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {guide.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>

        {GUIDES.map((guide) => (
          <Panel key={guide.slug} title={guide.title} id={`guide-${guide.slug}`}>
            <p className="text-sm text-muted-foreground">{guide.summary}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {guide.steps.map((step) => (
                <li key={step}>
                  <RichText text={step} />
                </li>
              ))}
            </ol>
            {guide.notes && guide.notes.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {guide.notes.map((note) => (
                  <li
                    key={note}
                    className="border-l-2 border-primary/40 pl-2 text-sm text-muted-foreground"
                  >
                    <RichText text={note} />
                  </li>
                ))}
              </ul>
            )}
            <p className="eyebrow mt-4">
              For {guide.roles.map(formatRole).join(", ")}
            </p>
          </Panel>
        ))}

        <Panel title="Troubleshooting and FAQ" id="faq">
          <div className="space-y-5">
            {FAQ.map((entry) => (
              <section key={entry.slug} id={`faq-${entry.slug}`}>
                <h3 className="text-sm font-semibold">{entry.question}</h3>
                <RichText text={entry.answer} className="mt-1 text-sm text-muted-foreground" />
                {entry.points && entry.points.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {entry.points.map((point) => (
                      <li key={point}>
                        <RichText text={point} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="Page by page" id="pages">
          <p className="mb-3 text-sm text-muted-foreground">
            Each of these pages has its own help in the ? panel.
          </p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
            {HELP_ENTRIES.map((entry) => (
              <li key={entry.route}>
                <Link href={entry.route} className="text-sm text-primary hover:underline">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
