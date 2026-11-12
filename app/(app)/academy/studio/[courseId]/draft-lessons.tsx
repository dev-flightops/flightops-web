"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { draftRefusalWords, pagesText } from "@/lib/academy/lesson-drafts";
import type { DraftDocument, LessonDraft } from "@/lib/api/lesson-drafts";

import { addDraftAction, startDraftAction } from "./draft-actions";

/** How often the draft is asked after while it runs, and for how long. */
const POLL_MS = 3000;
const GIVE_UP_MS = 12 * 60 * 1000;

/**
 * Lessons drafted from one of the company's documents (the bug doc's
 * Section 6, the client's item 4: "build lesson content from our own
 * documents (GOM, training manual, etc.) so we aren't building everything
 * from scratch"). The author picks a document; the draft comes back as
 * lessons, each saying the pages it drew on, and a quiz if asked for. Nothing
 * is added until the author keeps what they want, and what is kept is theirs
 * to edit like any lesson.
 */
export function DraftLessons({
  courseId,
  published,
  documents,
}: {
  courseId: string;
  published: boolean;
  documents: DraftDocument[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState(documents[0]?.document_id ?? "");
  const [lessons, setLessons] = useState(3);
  const [quiz, setQuiz] = useState(true);
  const [focus, setFocus] = useState("");
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
  const [keepQuiz, setKeepQuiz] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // While it runs, ask after it.
  useEffect(() => {
    if (!draft || draft.status !== "running") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        setDraft(null);
        setError("The draft is taking longer than it should. Try again, with fewer lessons or a narrower focus.");
        return;
      }
      try {
        const response = await fetch(`/api/academy/lesson-drafts/${draft.id}`, { cache: "no-store" });
        if (!response.ok) {
          clearInterval(timer);
          const detail = (await response.json().catch(() => null))?.detail;
          setDraft(null);
          setError(draftRefusalWords(detail) ?? "The draft couldn't be read. Try again.");
          return;
        }
        const next = (await response.json()) as LessonDraft;
        if (next.status !== "running") {
          clearInterval(timer);
          if (next.status === "failed") {
            // Back to the form, saying why.
            setDraft(null);
            setError(draftRefusalWords(next.error) ?? "The draft didn't work. Try again.");
            return;
          }
          setDraft(next);
          setKept(new Set((next.result?.lessons ?? []).map((_, index) => index)));
        }
      } catch {
        // A dropped connection: ask again next time.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [draft]);

  const picked = documents.find((doc) => doc.document_id === documentId);

  const start = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await startDraftAction(courseId, {
        documentId,
        lessons,
        quiz,
        focus,
        unread: picked?.text_status !== "extracted",
      });
      if (result.error || !result.draft) {
        setError(result.error ?? "The draft couldn't be started.");
        return;
      }
      setDraft(result.draft);
    });

  const add = () =>
    startTransition(async () => {
      if (!draft) return;
      setError(null);
      const result = await addDraftAction(courseId, draft.id, {
        lessons: [...kept],
        quiz: keepQuiz,
      });
      if (result.error) {
        setError(result.error);
        if (result.added) router.refresh();
        return;
      }
      setNotice(
        `Added ${result.added} lesson${result.added === 1 ? "" : "s"} at the end of the course, ready to edit.`,
      );
      setDraft(null);
      router.refresh();
    });

  const drafted = draft?.status === "done" ? draft.result : null;

  return (
    <section aria-label="Draft lessons from a document" className="mt-6 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow">Draft lessons from a document</h2>
        <button type="button" className={linkCaps} onClick={() => setOpen((was) => !was)}>
          {open ? "Close" : "Open"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick a manual or handbook from the document library: lessons are drafted from its pages for
        you to check and edit, with a quiz if you want one. Nothing is added until you say.
      </p>
      {notice ? (
        <p role="status" className="mt-3 notice notice-green">
          {notice}
        </p>
      ) : null}
      {open ? (
        <div className="mt-4 space-y-4">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There&apos;s nothing in the document library to draft from yet: add a PDF there first.
            </p>
          ) : !draft ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="field-label">Document</span>
                <select
                  className="ff-input"
                  value={documentId}
                  onChange={(event) => setDocumentId(event.currentTarget.value)}
                >
                  {documents.map((doc) => (
                    <option key={doc.document_id} value={doc.document_id}>
                      {doc.title}
                      {doc.page_count ? ` (${doc.page_count} page${doc.page_count === 1 ? "" : "s"})` : ""}
                      {doc.text_status !== "extracted" ? " — read when you draft" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Lessons</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="ff-input"
                  value={lessons}
                  onChange={(event) => setLessons(Number(event.currentTarget.value) || 1)}
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={quiz} onChange={(event) => setQuiz(event.currentTarget.checked)} />
                And a quiz
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Focus (optional)</span>
                <input
                  className="ff-input"
                  maxLength={300}
                  placeholder="e.g. de-icing, or chapter 4"
                  value={focus}
                  onChange={(event) => setFocus(event.currentTarget.value)}
                />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <button type="button" className={buttonSolid} disabled={pending || !documentId} onClick={start}>
                  {pending ? "Starting…" : "Draft lessons"}
                </button>
              </div>
            </div>
          ) : draft.status === "running" ? (
            <p role="status" className="text-sm text-muted-foreground">
              Drafting from {draft.document_title}. This takes a minute or two; you can keep working.
            </p>
          ) : drafted ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                From {draft.document_title}
                {draft.partial ? `, reading ${pagesText(draft.pages_read)} of it` : ""}. Keep what you
                want; each lesson ends by saying the pages it came from.
              </p>
              {published ? (
                <p role="note" className="notice notice-yellow">
                  <span className="notice-label">Published</span>
                  <span className="text-foreground">
                    This course is published: lessons you add show to its learners at once. Check them
                    before adding, or unpublish the course first.
                  </span>
                </p>
              ) : null}
              <ol className="space-y-3">
                {drafted.lessons.map((lesson, index) => (
                  <li key={index} className="rounded-md border border-border p-3">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={kept.has(index)}
                        onChange={(event) => {
                          const next = new Set(kept);
                          if (event.currentTarget.checked) next.add(index);
                          else next.delete(index);
                          setKept(next);
                        }}
                      />
                      <span>
                        <span className="text-sm font-semibold text-foreground">{lesson.title}</span>
                        {lesson.pages.length ? (
                          <span className="ml-2 text-xs text-muted-foreground">{pagesText(lesson.pages)}</span>
                        ) : null}
                      </span>
                    </label>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Read it</summary>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{lesson.body_markdown}</div>
                    </details>
                  </li>
                ))}
              </ol>
              {drafted.quiz ? (
                <div className="rounded-md border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={keepQuiz}
                      onChange={(event) => setKeepQuiz(event.currentTarget.checked)}
                    />
                    {drafted.quiz.title}: {drafted.quiz.questions.length} question
                    {drafted.quiz.questions.length === 1 ? "" : "s"}, on the last lesson added, passed at 80%
                  </label>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                    {drafted.quiz.questions.map((question, index) => (
                      <li key={index}>
                        {question.prompt}
                        <ul className="mt-1 text-xs text-muted-foreground">
                          {question.options.map((option, choice) => (
                            <li key={choice}>
                              {choice === question.correct_option ? "✓ " : "· "}
                              {option}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={buttonOutline} disabled={pending} onClick={() => setDraft(null)}>
                  Discard
                </button>
                <button type="button" className={buttonSolid} disabled={pending || kept.size === 0} onClick={add}>
                  {pending
                    ? "Adding…"
                    : `Add ${kept.size} lesson${kept.size === 1 ? "" : "s"}${keepQuiz && drafted.quiz ? " and the quiz" : ""}`}
                </button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="notice notice-red">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
