import { formatRole } from "@/lib/roles";

import { HELP_ENTRIES, type HelpEntry } from "./catalogue";
import { FAQ } from "./faq";
import { GUIDES } from "./guides";
import { WORKFLOW } from "./workflow";

/**
 * Everything the help assistant answers from, as one text (#114).
 *
 * The workflow, the guides, the FAQ and every page article, in that
 * order: the general first, so a question about a job meets the guide
 * before the article about one of its screens.
 *
 * DETERMINISTIC, BECAUSE IT IS HASHED AND CACHED
 *
 * The ai service holds this text by its SHA-256 and caches it in the
 * model's prompt; any byte that changes between two builds of the same
 * content is a cache miss on every question and a re-upload. So: fixed
 * order from the source arrays, no dates, nothing per request. The
 * route handler computes the hash once (app/api/help/ask/route.ts).
 */
export function helpCorpus(): string {
  const out: string[] = [
    "# Peregrine Flight Ops help",
    "",
    "Pages are named by their paths: link to a page with its path. Guides and",
    "FAQ answers are on /help, at the links given with each.",
    "",
    "## From booking to invoice",
    "Link: /help#workflow",
  ];
  WORKFLOW.forEach((stage, i) =>
    out.push(`${i + 1}. **${stage.title}** (${stage.who}; page ${stage.page}): ${stage.what}`),
  );

  out.push("", "## How-to guides");
  for (const guide of GUIDES) {
    out.push(
      "",
      `### ${guide.title}`,
      `Link: /help#guide-${guide.slug}`,
      `For: ${guide.roles.map(formatRole).join(", ")}`,
      `Pages: ${guide.pages.join(", ")}`,
      guide.summary,
    );
    guide.steps.forEach((step, i) => out.push(`${i + 1}. ${step}`));
    if (guide.notes?.length) {
      out.push("Notes:");
      guide.notes.forEach((note) => out.push(`- ${note}`));
    }
  }

  out.push("", "## Troubleshooting and FAQ");
  for (const entry of FAQ) {
    out.push(
      "",
      `### ${entry.question}`,
      `Link: /help#faq-${entry.slug}`,
      `Pages: ${entry.pages.join(", ")}`,
      entry.answer,
    );
    entry.points?.forEach((point) => out.push(`- ${point}`));
  }

  out.push("", "## Page by page");
  for (const entry of HELP_ENTRIES) out.push("", ...articleLines(entry));

  return `${out.join("\n")}\n`;
}

function articleLines(entry: HelpEntry): string[] {
  const lines = [`### ${entry.title}`, `Page: ${entry.route}`];
  if (entry.whoCanUse?.length) {
    lines.push(`Written for: ${entry.whoCanUse.map(formatRole).join(", ")}`);
  }
  lines.push(entry.whatItDoes);
  if (entry.howToUse.length) {
    lines.push("How to use it:");
    entry.howToUse.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  for (const section of entry.sections ?? []) {
    lines.push(`${section.heading}:`);
    if (section.body) lines.push(section.body);
    section.steps?.forEach((step) => lines.push(`- ${step}`));
  }
  if (entry.connectsTo) lines.push(`Where the numbers come from: ${entry.connectsTo}`);
  if (entry.worthKnowing?.length) {
    lines.push("Worth knowing:");
    entry.worthKnowing.forEach((note) => lines.push(`- ${note}`));
  }
  if (entry.example) lines.push(`For example: ${entry.example}`);
  if (entry.related?.length) lines.push(`Related pages: ${entry.related.join(", ")}`);
  return lines;
}
