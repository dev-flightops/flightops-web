"use client";

import { useActionState, useState } from "react";

import type { QuizAdminResponse, QuizQuestionAdmin } from "@/lib/api/academy";

import {
  addQuestionAction,
  deleteQuestionAction,
  deleteQuizAction,
  type QuizEditorState,
  updateQuestionAction,
  updateQuizAction,
} from "./actions";

const _initial: QuizEditorState = { status: "idle" };

export function QuizEditor({ quiz }: { quiz: QuizAdminResponse }) {
  return (
    <div className="space-y-6">
      <QuizMetaCard quiz={quiz} />
      <QuestionListCard quiz={quiz} />
      <AddQuestionCard quizId={quiz.id} />
      <DangerZone quizId={quiz.id} />
    </div>
  );
}

function QuizMetaCard({ quiz }: { quiz: QuizAdminResponse }) {
  const [state, formAction, pending] = useActionState(
    updateQuizAction,
    _initial,
  );
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Quiz details
      </h2>
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="quiz_id" value={quiz.id} />
        <label className="block">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Title
          </span>
          <input
            name="title"
            defaultValue={quiz.title}
            required
            maxLength={200}
            className="ff mt-1"
          />
        </label>
        <label className="block">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Instructions (optional)
          </span>
          <textarea
            name="instructions"
            defaultValue={quiz.instructions ?? ""}
            rows={3}
            maxLength={4000}
            placeholder="Shown at the top of the quiz — e.g. 'Read each prompt carefully.'"
            className="ff mt-1"
          />
        </label>
        <label className="block max-w-xs">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Pass threshold (%)
          </span>
          <input
            name="pass_threshold"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={quiz.pass_threshold}
            className="ff mt-1"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
      <FormStyles />
    </section>
  );
}

function QuestionListCard({ quiz }: { quiz: QuizAdminResponse }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Questions ({quiz.questions.length})
      </h2>
      {quiz.questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No questions yet. Add the first one below.
        </p>
      ) : (
        <ol className="space-y-3">
          {quiz.questions.map((q) => (
            <QuestionRow key={q.id} quizId={quiz.id} question={q} />
          ))}
        </ol>
      )}
    </section>
  );
}

function QuestionRow({
  quizId,
  question,
}: {
  quizId: string;
  question: QuizQuestionAdmin;
}) {
  const [editing, setEditing] = useState(false);
  const [delState, delAction, delPending] = useActionState(
    deleteQuestionAction,
    _initial,
  );

  return (
    <li className="rounded-md border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            {String(question.ordinal).padStart(2, "0")}.
          </span>{" "}
          {question.prompt}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-border bg-muted/20 px-2 py-1 text-[0.6875rem] font-semibold hover:bg-muted/40"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <form action={delAction}>
            <input type="hidden" name="quiz_id" value={quizId} />
            <input type="hidden" name="question_id" value={question.id} />
            <button
              type="submit"
              disabled={delPending}
              className="rounded-md border border-status-red/40 bg-status-red/10 px-2 py-1 text-[0.6875rem] font-semibold text-status-red hover:bg-status-red/15 disabled:opacity-60"
            >
              {delPending ? "…" : "Delete"}
            </button>
          </form>
        </div>
      </div>
      {delState.status === "error" && delState.message ? (
        <ErrorBanner message={delState.message} />
      ) : null}
      {editing ? (
        <QuestionForm
          quizId={quizId}
          question={question}
          onDone={() => setEditing(false)}
        />
      ) : (
        <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
          {question.options.map((opt, idx) => (
            <li
              key={idx}
              className={
                idx === question.correct_option_index
                  ? "font-semibold text-status-green"
                  : ""
              }
            >
              {opt}
              {idx === question.correct_option_index ? " ✓" : ""}
            </li>
          ))}
          {question.explanation ? (
            <li className="list-none pt-1 italic text-muted-foreground/80">
              Note: {question.explanation}
            </li>
          ) : null}
        </ul>
      )}
      <FormStyles />
    </li>
  );
}

/**
 * Reusable question form used by both AddQuestionCard (empty defaults)
 * and QuestionRow's inline edit. The client state tracks the options
 * list + which index is correct — server action pulls both out of
 * FormData via `option-<idx>` naming.
 */
function QuestionForm({
  quizId,
  question,
  onDone,
}: {
  quizId: string;
  question?: QuizQuestionAdmin;
  onDone?: () => void;
}) {
  const isEdit = Boolean(question);
  const [options, setOptions] = useState<string[]>(
    question?.options ?? ["", ""],
  );
  const [correctIndex, setCorrectIndex] = useState<number>(
    question?.correct_option_index ?? 0,
  );
  const [state, formAction, pending] = useActionState(
    isEdit ? updateQuestionAction : addQuestionAction,
    _initial,
  );

  // Reset local state after a successful save so a fresh AddQuestion
  // form doesn't hold on to the last entry.
  if (state.status === "ok" && !isEdit) {
    // Deferred to next tick via requestIdleCallback would be nicer,
    // but useState re-runs on each render — resetting inline is fine.
    if (options.length !== 2 || options.some((o) => o !== "")) {
      setOptions(["", ""]);
      setCorrectIndex(0);
    }
  }
  if (state.status === "ok" && isEdit && onDone) {
    // Fire-and-forget close; parent list revalidates on the server so
    // the new snapshot will render even if we linger for a paint.
    setTimeout(onDone, 0);
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    if (correctIndex === idx) {
      setCorrectIndex(0);
    } else if (correctIndex > idx) {
      setCorrectIndex(correctIndex - 1);
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <input type="hidden" name="quiz_id" value={quizId} />
      {isEdit && question ? (
        <input type="hidden" name="question_id" value={question.id} />
      ) : null}
      <label className="block">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Prompt
        </span>
        <textarea
          name="prompt"
          defaultValue={question?.prompt ?? ""}
          rows={2}
          required
          maxLength={2000}
          className="ff mt-1"
        />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Options (2–6)
          </span>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 6}
            className="text-[0.6875rem] font-semibold text-status-blue hover:underline disabled:opacity-40"
          >
            + Add option
          </button>
        </div>
        <ul className="space-y-1.5">
          {options.map((opt, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct_option_index"
                value={idx}
                checked={correctIndex === idx}
                onChange={() => setCorrectIndex(idx)}
                aria-label={`Mark option ${idx + 1} correct`}
              />
              <input
                name={`option-${idx}`}
                value={opt}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((v, i) => (i === idx ? e.target.value : v)),
                  )
                }
                required
                maxLength={500}
                placeholder={`Option ${idx + 1}`}
                className="ff flex-1"
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={options.length <= 2}
                className="text-[0.6875rem] font-semibold text-status-red hover:underline disabled:opacity-30"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      <label className="block">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Explanation (optional — shown after learner submits)
        </span>
        <textarea
          name="explanation"
          defaultValue={question?.explanation ?? ""}
          rows={2}
          maxLength={2000}
          className="ff mt-1"
        />
      </label>
      <div className="flex justify-end gap-2">
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-semibold hover:bg-muted/20"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : isEdit ? "Save question" : "Add question"}
        </button>
      </div>
    </form>
  );
}

function AddQuestionCard({ quizId }: { quizId: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Add question
      </h2>
      <QuestionForm quizId={quizId} />
      <FormStyles />
    </section>
  );
}

function DangerZone({ quizId }: { quizId: string }) {
  return (
    <section className="rounded-lg border border-status-red/30 bg-status-red/5 p-4">
      <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-status-red">
        Danger zone
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Deleting the quiz removes it plus every question and every
        recorded attempt. The lesson reverts to non-quiz-gated.
      </p>
      <form action={deleteQuizAction}>
        <input type="hidden" name="quiz_id" value={quizId} />
        <button
          type="submit"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-1.5 text-xs font-semibold text-status-red hover:bg-status-red/15"
        >
          Delete quiz
        </button>
      </form>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-3 rounded-md border border-status-red/40 bg-status-red/10 px-2 py-1 text-[0.6875rem] font-semibold text-status-red"
    >
      {message}
    </p>
  );
}

function FormStyles() {
  return (
    <style>{`
      .ff {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid hsl(var(--border));
        border-radius: 0.375rem;
        background: hsl(var(--background));
        font-size: 0.8125rem;
        color: hsl(var(--foreground));
      }
      .ff:focus {
        outline: none;
        border-color: hsl(var(--ring));
      }
    `}</style>
  );
}
