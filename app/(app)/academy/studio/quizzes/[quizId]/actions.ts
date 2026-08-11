"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addQuizQuestion,
  deleteQuiz,
  deleteQuizQuestion,
  updateQuiz,
  updateQuizQuestion,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

export interface QuizEditorState {
  status: "idle" | "error" | "ok";
  message?: string;
}

function _mapError(err: ApiError): string {
  let detail: string | undefined;
  try {
    const parsed = JSON.parse(err.message);
    if (typeof parsed?.detail === "string") detail = parsed.detail;
  } catch {
    // Non-JSON body — fall through.
  }
  switch (detail) {
    case "quiz_not_found":
      return "Quiz not found — it may have been deleted in another tab.";
    case "question_not_found":
      return "Question not found — refresh to see the current list.";
    case "correct_option_index_out_of_range":
      return "Pick a correct answer index within the options you supplied.";
    case "options_must_be_2_to_6":
      return "A question needs between 2 and 6 answer choices.";
    case "cannot_edit_quiz_with_attempts":
      return "This quiz already has recorded attempts. Delete the attempts (or the quiz) before editing.";
  }
  return `Backend returned HTTP ${err.status}.`;
}

async function _run(
  quizId: string,
  op: () => Promise<unknown>,
): Promise<QuizEditorState> {
  try {
    await op();
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: "error", message: _mapError(err) };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
  revalidatePath(`/academy/studio/quizzes/${quizId}`);
  return { status: "ok" };
}

export async function updateQuizAction(
  _prev: QuizEditorState,
  formData: FormData,
): Promise<QuizEditorState> {
  const quizId = String(formData.get("quiz_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructionsRaw = String(formData.get("instructions") ?? "");
  const instructions = instructionsRaw.trim() === "" ? null : instructionsRaw;
  const passRaw = String(formData.get("pass_threshold") ?? "").trim();
  const passNumber = passRaw === "" ? undefined : Number(passRaw);
  if (!quizId) return { status: "error", message: "Missing quiz id." };
  if (!title) return { status: "error", message: "Title is required." };
  if (passNumber !== undefined) {
    if (Number.isNaN(passNumber) || passNumber < 0 || passNumber > 100) {
      return {
        status: "error",
        message: "Pass threshold must be a percentage 0–100.",
      };
    }
  }
  return _run(quizId, () =>
    updateQuiz(quizId, {
      title,
      instructions,
      pass_threshold: passNumber,
    }),
  );
}

export async function addQuestionAction(
  _prev: QuizEditorState,
  formData: FormData,
): Promise<QuizEditorState> {
  const quizId = String(formData.get("quiz_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const explanationRaw = String(formData.get("explanation") ?? "");
  const explanation =
    explanationRaw.trim() === "" ? null : explanationRaw;
  // Options come in as `option-0`, `option-1`, … so the FormData shape
  // survives client-side add/remove of rows without renumbering.
  const options: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("option-") && typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") options.push(trimmed);
    }
  }
  const correctIndex = Number(formData.get("correct_option_index") ?? "-1");
  if (!quizId) return { status: "error", message: "Missing quiz id." };
  if (!prompt) return { status: "error", message: "Prompt is required." };
  if (options.length < 2 || options.length > 6) {
    return {
      status: "error",
      message: "A question needs 2–6 non-empty options.",
    };
  }
  if (
    Number.isNaN(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    return {
      status: "error",
      message: "Pick which option is correct.",
    };
  }
  return _run(quizId, () =>
    addQuizQuestion(quizId, {
      prompt,
      options,
      correct_option_index: correctIndex,
      explanation,
    }),
  );
}

export async function updateQuestionAction(
  _prev: QuizEditorState,
  formData: FormData,
): Promise<QuizEditorState> {
  const quizId = String(formData.get("quiz_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const explanationRaw = String(formData.get("explanation") ?? "");
  const explanation =
    explanationRaw.trim() === "" ? null : explanationRaw;
  const options: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("option-") && typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") options.push(trimmed);
    }
  }
  const correctIndex = Number(formData.get("correct_option_index") ?? "-1");
  if (!quizId || !questionId) {
    return { status: "error", message: "Missing ids." };
  }
  if (!prompt) return { status: "error", message: "Prompt is required." };
  if (options.length < 2 || options.length > 6) {
    return {
      status: "error",
      message: "A question needs 2–6 non-empty options.",
    };
  }
  if (
    Number.isNaN(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    return {
      status: "error",
      message: "Pick which option is correct.",
    };
  }
  return _run(quizId, () =>
    updateQuizQuestion(quizId, questionId, {
      prompt,
      options,
      correct_option_index: correctIndex,
      explanation,
    }),
  );
}

export async function deleteQuestionAction(
  _prev: QuizEditorState,
  formData: FormData,
): Promise<QuizEditorState> {
  const quizId = String(formData.get("quiz_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  if (!quizId || !questionId) {
    return { status: "error", message: "Missing ids." };
  }
  return _run(quizId, () => deleteQuizQuestion(quizId, questionId));
}

export async function deleteQuizAction(formData: FormData): Promise<void> {
  const quizId = String(formData.get("quiz_id") ?? "");
  if (!quizId) return;
  try {
    await deleteQuiz(quizId);
  } catch {
    // Silent — surface via list refresh; the studio page shows the
    // Attach Quiz button again as soon as the underlying lesson
    // reloads. A future refactor can surface delete errors inline.
  }
  revalidatePath("/academy/studio");
  redirect("/academy/studio");
}
