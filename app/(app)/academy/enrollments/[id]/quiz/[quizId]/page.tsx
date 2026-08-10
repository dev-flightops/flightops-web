import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getEnrollment,
  getLearnerQuiz,
  listMyQuizAttempts,
  type Enrollment,
  type QuizAttemptResponse,
  type QuizLearnerResponse,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { QuizRunner } from "./quiz-runner";

/**
 * /academy/enrollments/[id]/quiz/[quizId] — Quiz Runner.
 *
 * Learner path for a quiz-gated lesson. Renders the quiz form; on
 * submit the QuizRunner component calls the submit action and swaps
 * into a result view (score + per-question correctness + Retake +
 * Back to lesson). Existing attempts are surfaced above the form so
 * a learner who's already passed sees that state before answering
 * again.
 */
export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id: enrollmentId, quizId } = await params;
  const { lesson: lessonParam } = await searchParams;

  let enrollment: Enrollment;
  try {
    enrollment = await getEnrollment(enrollmentId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  let quiz: QuizLearnerResponse;
  try {
    quiz = await getLearnerQuiz(enrollmentId, quizId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  // Prior attempts drive both the "you already passed" banner and
  // the Retake CTA. Failure here isn't fatal — worst case the runner
  // renders as if the learner has no history.
  let priorAttempts: QuizAttemptResponse[] = [];
  try {
    priorAttempts = await listMyQuizAttempts(enrollmentId, quizId);
  } catch {
    priorAttempts = [];
  }
  const passingAttempt = priorAttempts.find((a) => a.is_pass) ?? null;

  const backToLessonHref = lessonParam
    ? `/academy/enrollments/${enrollmentId}?lesson=${lessonParam}`
    : `/academy/enrollments/${enrollmentId}?lesson=${quiz.lesson_id}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href={backToLessonHref} className="hover:text-foreground">
            ← Back to lesson
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {quiz.title}
        </h1>
        {quiz.instructions ? (
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
            {quiz.instructions}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
          {" · "}
          Pass ≥ {quiz.pass_threshold}%
        </p>
      </header>

      {passingAttempt ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-status-green/40 bg-status-green/10 px-4 py-3 text-sm text-status-green"
        >
          <p className="font-semibold">
            You already passed this quiz —{" "}
            {passingAttempt.score}/{passingAttempt.question_count} correct.
          </p>
          <p className="mt-0.5 text-xs text-status-green/80">
            Retake below if you want to study the material again, or head
            back to the lesson to mark it complete.
          </p>
        </div>
      ) : priorAttempts.length > 0 ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-4 py-3 text-sm text-status-yellow"
        >
          <p className="font-semibold">
            {priorAttempts.length} prior attempt{priorAttempts.length === 1 ? "" : "s"}
            {" — highest score "}
            {Math.max(...priorAttempts.map((a) => a.score))}/
            {priorAttempts[0].question_count}. Not passing yet — try again.
          </p>
        </div>
      ) : null}

      <QuizRunner
        enrollmentId={enrollmentId}
        quiz={quiz}
        backToLessonHref={backToLessonHref}
      />
    </div>
  );
}
