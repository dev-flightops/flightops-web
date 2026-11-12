/**
 * Lessons drafted from a company document, for the Course studio (the bug
 * doc's Section 6, the client's item 4).
 *
 *   GET  /ai/lesson-drafts/documents   documents to draft from
 *   POST /ai/lesson-drafts             start a draft (202, runs on)
 *   GET  /ai/lesson-drafts/{id}        the draft, done or not
 *
 * A document whose text hasn't been read out is read out first
 * (readDocumentText in document-limits.ts). A draft is the author's
 * starting point: the lessons they keep are added to the course for them to
 * edit. On a published course they show to learners at once, which the
 * studio says before anything is added.
 */

import { apiFetch } from "./client";

export interface DraftDocument {
  document_id: string;
  title: string;
  category: string;
  /** "extracted", or null: not read out yet, which happens when it's picked. */
  text_status: string | null;
  page_count: number | null;
}

export interface DraftLesson {
  title: string;
  body_markdown: string;
  /** The document's pages the lesson draws on. */
  pages: number[];
}

export interface DraftQuestion {
  prompt: string;
  options: string[];
  correct_option: number;
  explanation: string | null;
  page: number | null;
}

export interface DraftQuiz {
  title: string;
  questions: DraftQuestion[];
}

export interface LessonDraft {
  id: string;
  status: "running" | "done" | "failed";
  course_id: string;
  document_id: string;
  document_title: string;
  lessons_wanted: number;
  with_quiz: boolean;
  focus: string | null;
  pages_read: number[];
  /** Fewer pages were read than the document has. */
  partial: boolean;
  result: { lessons: DraftLesson[]; quiz: DraftQuiz | null } | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface StartDraftInput {
  course_id: string;
  document_id: string;
  lessons: number;
  quiz: boolean;
  focus: string | null;
}

export async function listDraftDocuments(): Promise<DraftDocument[]> {
  const { items } = await apiFetch<{ items: DraftDocument[] }>("/ai/lesson-drafts/documents");
  return items;
}

export async function startLessonDraft(input: StartDraftInput): Promise<LessonDraft> {
  return apiFetch<LessonDraft>("/ai/lesson-drafts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getLessonDraft(draftId: string): Promise<LessonDraft> {
  return apiFetch<LessonDraft>(`/ai/lesson-drafts/${draftId}`);
}
