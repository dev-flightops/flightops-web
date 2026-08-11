import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { getAdminQuiz } from "@/lib/api/academy";

import { QuizEditor } from "./quiz-editor";

/**
 * /academy/studio/quizzes/{quizId} — admin quiz editor.
 *
 * Attaches to the /academy/studio/{courseId} page via each lesson row's
 * "Attach Quiz" / "Edit Quiz" affordance. Author-owned surface —
 * question CRUD, pass threshold, instructions.
 *
 * Backend gates every /academy/quizzes/* endpoint on Chief Pilot /
 * Exec Admin. A pilot who navigates here directly gets a 403 which
 * we translate into notFound() (info-hide).
 */
export const dynamic = "force-dynamic";

export default async function StudioQuizEditorPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;

  let quiz;
  try {
    quiz = await getAdminQuiz(quizId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/academy/studio" className="hover:underline">
          Studio
        </Link>
        {" / "}
        <span className="text-foreground">Quiz</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Quiz Editor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Author the questions learners will see. Pass threshold below
          controls the minimum score for a passing attempt.
        </p>
      </header>
      <QuizEditor quiz={quiz} />
    </div>
  );
}
