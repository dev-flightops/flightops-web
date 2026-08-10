"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  QuizAttemptResponse,
  QuizLearnerResponse,
} from "@/lib/api/academy";

import { submitQuizAction } from "../../actions";

interface Props {
  enrollmentId: string;
  quiz: QuizLearnerResponse;
  backToLessonHref: string;
}

type LocalAttempt = Pick<
  QuizAttemptResponse,
  "score" | "question_count" | "is_pass" | "per_question"
>;

/**
 * Two visible states:
 *   • Answering — one radio group per question + Submit. Submit stays
 *     disabled until every question has a chosen index (no partial
 *     submits — the backend rejects any answers.length mismatch and
 *     surfaces it as a 400, so gating client-side is the friendlier
 *     path).
 *   • Result — score, per-question ✓/✗ with the correct answer + any
 *     author-supplied explanation, plus Retake + Back to lesson CTAs.
 *
 * The runner is fully client-side after mount; it doesn't need to
 * revalidate the whole enrollment page because the parent /lesson
 * view will re-query listMyQuizAttempts on next navigation.
 */
export function QuizRunner({ enrollmentId, quiz, backToLessonHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Array<number | null>>(
    () => quiz.questions.map(() => null),
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocalAttempt | null>(null);

  function chooseAnswer(qIdx: number, optionIdx: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = optionIdx;
      return next;
    });
  }

  const allAnswered = answers.every((a) => a !== null);

  function submit(evt: React.FormEvent) {
    evt.preventDefault();
    if (!allAnswered) return;
    setError(null);
    const payload = answers.map((a) => a as number);
    startTransition(async () => {
      const outcome = await submitQuizAction(enrollmentId, quiz.id, payload);
      if (outcome.status !== "ok" || !outcome.attempt) {
        setError(outcome.message ?? "Couldn't submit the attempt.");
        return;
      }
      setResult({
        score: outcome.attempt.score,
        question_count: outcome.attempt.question_count,
        is_pass: outcome.attempt.is_pass,
        per_question: outcome.attempt.per_question,
      });
      // Server action already revalidated the parent lesson view;
      // refresh the router so navigating back picks up the newly
      // inserted attempt without a hard reload.
      router.refresh();
    });
  }

  function retake() {
    setResult(null);
    setError(null);
    setAnswers(quiz.questions.map(() => null));
  }

  if (result) {
    return (
      <ResultView
        result={result}
        quiz={quiz}
        onRetake={retake}
        backToLessonHref={backToLessonHref}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {error}
        </div>
      )}
      <ol className="space-y-4">
        {quiz.questions.map((q, qIdx) => (
          <li
            key={q.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">
                <span className="mr-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Q{qIdx + 1}
                </span>
                {q.prompt}
              </legend>
              <div className="mt-2 space-y-1.5">
                {q.options.map((opt, oIdx) => {
                  const inputId = `q${qIdx}-opt${oIdx}`;
                  return (
                    <label
                      key={oIdx}
                      htmlFor={inputId}
                      className={
                        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition " +
                        (answers[qIdx] === oIdx
                          ? "border-status-blue/60 bg-status-blue/10"
                          : "border-border hover:bg-muted/10")
                      }
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[qIdx] === oIdx}
                        onChange={() => chooseAnswer(qIdx, oIdx)}
                        disabled={pending}
                        className="mt-0.5 accent-status-blue"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backToLessonHref}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Back to lesson
        </Link>
        <button
          type="submit"
          disabled={pending || !allAnswered}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-status-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit answers"}
        </button>
      </div>
    </form>
  );
}

function ResultView({
  result,
  quiz,
  onRetake,
  backToLessonHref,
}: {
  result: LocalAttempt;
  quiz: QuizLearnerResponse;
  onRetake: () => void;
  backToLessonHref: string;
}) {
  const pct = Math.round((result.score / result.question_count) * 100);
  const questionsById = new Map(quiz.questions.map((q) => [q.id, q]));
  return (
    <div className="space-y-5">
      <div
        role="status"
        className={
          "rounded-lg border px-5 py-4 " +
          (result.is_pass
            ? "border-status-green/40 bg-status-green/10"
            : "border-status-red/40 bg-status-red/10")
        }
      >
        <p
          className={
            "text-sm font-semibold " +
            (result.is_pass ? "text-status-green" : "text-status-red")
          }
        >
          {result.is_pass ? "✓ Passed" : "✗ Not passing yet"} —{" "}
          {result.score} of {result.question_count} correct ({pct}%)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {result.is_pass
            ? "Head back to the lesson — Mark Complete is unlocked."
            : `Review the misses below, then retake when you're ready. Pass threshold ≥ ${quiz.pass_threshold}%.`}
        </p>
      </div>

      <ol className="space-y-3">
        {result.per_question.map((pq) => {
          const q = questionsById.get(pq.question_id);
          const correctLabel = q?.options[pq.correct_index] ?? "—";
          const chosenLabel = q?.options[pq.chosen_index] ?? "—";
          return (
            <li
              key={pq.question_id}
              className={
                "rounded-lg border px-4 py-3 text-sm " +
                (pq.is_correct
                  ? "border-status-green/30 bg-status-green/5"
                  : "border-status-red/30 bg-status-red/5")
              }
            >
              <p className="font-semibold text-foreground">
                <span className="mr-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Q{pq.ordinal}
                </span>
                {q?.prompt ?? "Question unavailable"}
              </p>
              <p
                className={
                  "mt-1 text-xs " +
                  (pq.is_correct ? "text-status-green" : "text-status-red")
                }
              >
                {pq.is_correct ? "✓" : "✗"} Your answer: {chosenLabel}
              </p>
              {!pq.is_correct ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Correct answer: {correctLabel}
                </p>
              ) : null}
              {pq.explanation ? (
                <p className="mt-1 text-xs text-muted-foreground italic">
                  {pq.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/20"
        >
          Retake
        </button>
        <Link
          href={backToLessonHref}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-status-blue/90"
        >
          Back to lesson →
        </Link>
      </div>
    </div>
  );
}
