/**
 * Lessons drafted from a document (the bug doc's Section 6): what a kept
 * lesson says it came from, and the service's refusals in words.
 */

/** "page 4", "pages 4 and 5", "pages 4, 5 and 9". */
export function pagesText(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `page ${sorted[0]}`;
  return `pages ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

/** The last line of a kept lesson: where it came from, to check it against. */
export function sourceLine(documentTitle: string, pages: number[]): string {
  const where = pagesText(pages);
  return `Drafted from ${documentTitle}${where ? `, ${where}` : ""}. Check it against the document before publishing.`;
}

const REFUSALS: Record<string, string> = {
  too_many_drafts: "That's the hour's drafts for you. Try again in an hour.",
  anthropic_not_configured: "Drafting isn't set up on this server.",
  anthropic_timeout: "The draft took too long. Try fewer lessons, or a narrower focus.",
  document_text_unread: "That document's text hasn't been read out yet. Try again.",
  document_text_no_text: "That document has no text to read: it may be a scan. Upload a searchable PDF.",
  document_text_unsupported: "That kind of file can't be read for text. A PDF or a text file can.",
  document_text_failed: "That document's text couldn't be read. Upload it again as a PDF.",
  document_has_no_file: "That document has no file to read.",
  file_not_found: "That document's file is missing from the library. Upload it again there, then draft from it.",
  document_has_no_text: "That document has no text to read.",
  document_not_found: "That document is no longer in the library.",
  course_not_found: "This course is no longer there.",
  draft_not_found: "That draft has expired: drafts keep for two hours. Draft again.",
  nothing_usable_came_back: "Nothing usable came back from that document. Try a different focus.",
  draft_failed: "The draft didn't work. Try again in a moment.",
};

/** A refusal from the service, in words; null for one this doesn't know. */
export function draftRefusalWords(detail: string | null | undefined): string | null {
  return detail ? (REFUSALS[detail] ?? null) : null;
}
