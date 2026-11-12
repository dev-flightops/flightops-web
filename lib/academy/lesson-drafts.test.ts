import { describe, expect, it } from "vitest";

import { draftRefusalWords, pagesText, sourceLine } from "./lesson-drafts";

/** Lessons drafted from a document (the bug doc's Section 6). */

describe("a drafted lesson's source", () => {
  it("names the pages, in order, once each", () => {
    expect(pagesText([])).toBe("");
    expect(pagesText([4])).toBe("page 4");
    expect(pagesText([5, 4])).toBe("pages 4 and 5");
    expect(pagesText([9, 4, 5, 4])).toBe("pages 4, 5 and 9");
  });

  it("ends the lesson, to check it against", () => {
    expect(sourceLine("General Operations Manual", [2, 3])).toBe(
      "Drafted from General Operations Manual, pages 2 and 3. Check it against the document before publishing.",
    );
    expect(sourceLine("GOM", [])).toBe("Drafted from GOM. Check it against the document before publishing.");
  });

  it("puts the service's refusals in words", () => {
    expect(draftRefusalWords("too_many_drafts")).toMatch(/hour/);
    expect(draftRefusalWords("document_text_no_text")).toMatch(/scan/);
    expect(draftRefusalWords("file_not_found")).toMatch(/missing from the library\. Upload it again/);
    expect(draftRefusalWords("something_else")).toBeNull();
    expect(draftRefusalWords(null)).toBeNull();
  });
});
