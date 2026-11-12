"use server";

import { revalidatePath } from "next/cache";

import { draftRefusalWords, sourceLine } from "@/lib/academy/lesson-drafts";
import { addQuizQuestion, createLesson, createLessonQuiz } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";
import { readDocumentText } from "@/lib/api/document-limits";
import { type LessonDraft, getLessonDraft, startLessonDraft } from "@/lib/api/lesson-drafts";

/** What the service refused, in words. */
function refusal(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    try {
      const detail = JSON.parse(err.message)?.detail;
      const said = typeof detail === "string" ? draftRefusalWords(detail) : null;
      if (said) return said;
    } catch {
      // not JSON: the fallback below
    }
    if (err.status === 403) return "Only the Chief Pilot, the DO and an Exec Admin draft lessons.";
  }
  return fallback;
}

/** Start a draft (the bug doc's Section 6): a document never read out is
 *  read out first, as the limits reader does. */
export async function startDraftAction(
  courseId: string,
  input: { documentId: string; lessons: number; quiz: boolean; focus: string; unread: boolean },
): Promise<{ draft: LessonDraft | null; error: string | null }> {
  try {
    if (input.unread) {
      const read = await readDocumentText(input.documentId);
      if (read.text_status !== "extracted") {
        return { draft: null, error: draftRefusalWords(`document_text_${read.text_status}`) };
      }
    }
    const draft = await startLessonDraft({
      course_id: courseId,
      document_id: input.documentId,
      lessons: Math.min(Math.max(Math.round(input.lessons), 1), 6),
      quiz: input.quiz,
      focus: input.focus.trim() ? input.focus.trim().slice(0, 300) : null,
    });
    return { draft, error: null };
  } catch (err) {
    return { draft: null, error: refusal(err, "The draft couldn't be started. Try again in a moment.") };
  }
}

/** Add the lessons the author kept, and the quiz on the last of them. Read
 *  from the draft as the service holds it, not from the page. */
export async function addDraftAction(
  courseId: string,
  draftId: string,
  choice: { lessons: number[]; quiz: boolean },
): Promise<{ added: number; error: string | null }> {
  let draft: LessonDraft;
  try {
    draft = await getLessonDraft(draftId);
  } catch (err) {
    return { added: 0, error: refusal(err, "That draft couldn't be read. Try again.") };
  }
  const lessons = draft.result?.lessons ?? [];
  if (draft.course_id !== courseId || draft.status !== "done" || lessons.length === 0) {
    return { added: 0, error: "That draft isn't ready to add." };
  }
  const picked = [...new Set(choice.lessons)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < lessons.length)
    .sort((a, b) => a - b);
  if (picked.length === 0) return { added: 0, error: "Pick at least one lesson to add." };

  let added = 0;
  let lastLessonId: string | null = null;
  try {
    for (const index of picked) {
      const lesson = lessons[index];
      const made = await createLesson(courseId, {
        title: lesson.title,
        body_markdown: `${lesson.body_markdown}\n\n${sourceLine(draft.document_title, lesson.pages)}`,
      });
      lastLessonId = made.id;
      added += 1;
    }
    const quiz = draft.result?.quiz;
    if (choice.quiz && quiz && lastLessonId) {
      const made = await createLessonQuiz(lastLessonId, { title: quiz.title, pass_threshold: 80 });
      for (const question of quiz.questions) {
        await addQuizQuestion(made.id, {
          prompt: question.prompt,
          options: question.options,
          correct_option_index: question.correct_option,
          explanation: question.explanation,
        });
      }
    }
  } catch (err) {
    revalidatePath(`/academy/studio/${courseId}`);
    const what = added ? `${added} lesson${added === 1 ? " was" : "s were"} added before it stopped. ` : "";
    return { added, error: `${what}${refusal(err, "Adding the lessons didn't finish. Check the course and try again.")}` };
  }
  revalidatePath(`/academy/studio/${courseId}`);
  return { added, error: null };
}
