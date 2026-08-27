import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitQuizAction } = vi.hoisted(() => ({ submitQuizAction: vi.fn() }));
vi.mock("../../actions", () => ({ submitQuizAction }));

import { QuizRunner } from "./quiz-runner";
import type {
  QuizAttemptPerQuestion,
  QuizLearnerResponse,
} from "@/lib/api/academy";

/**
 * Quiz scoring is the start of a chain that ends in a compliance record:
 * pass -> certificate -> currency_completion -> the compliance board says
 * the pilot is current. So these tests care less about styling and more
 * about "could this hand someone a training record they did not earn, or
 * mislabel which answers were wrong".
 */

const QUIZ: QuizLearnerResponse = {
  id: "quiz-1",
  lesson_id: "lesson-1",
  title: "Icing Recognition",
  instructions: "Choose the best answer.",
  pass_threshold: 80,
  questions: [
    {
      id: "q-a",
      ordinal: 1,
      prompt: "First indication of airframe ice?",
      options: ["Windshield", "Wing leading edge", "Tail", "Spinner"],
    },
    {
      id: "q-b",
      ordinal: 2,
      prompt: "Boot cycling in light rime?",
      options: ["Immediately", "At 1/4 inch", "Never", "On descent only"],
    },
    {
      id: "q-c",
      ordinal: 3,
      prompt: "Freezing drizzle above the aircraft is a sign of?",
      options: ["SLD conditions", "Clear air", "Dry snow", "Fog"],
    },
  ],
};

const pq = (
  over: Partial<QuizAttemptPerQuestion> & { question_id: string },
): QuizAttemptPerQuestion => ({
  ordinal: 1,
  chosen_index: 0,
  correct_index: 0,
  is_correct: true,
  explanation: null,
  ...over,
});

function attempt(over: Record<string, unknown> = {}) {
  return {
    status: "ok" as const,
    attempt: {
      id: "att-1",
      quiz_id: "quiz-1",
      enrollment_id: "enr-1",
      user_id: "u-1",
      answers: [1, 1, 0],
      score: 3,
      question_count: 3,
      is_pass: true,
      submitted_at: "2026-08-26T00:00:00Z",
      per_question: [
        pq({ question_id: "q-a", ordinal: 1, chosen_index: 1, correct_index: 1 }),
        pq({ question_id: "q-b", ordinal: 2, chosen_index: 1, correct_index: 1 }),
        pq({ question_id: "q-c", ordinal: 3, chosen_index: 0, correct_index: 0 }),
      ],
      ...over,
    },
  };
}

const runner = () => (
  <QuizRunner
    enrollmentId="enr-1"
    quiz={QUIZ}
    backToLessonHref="/academy/enrollments/enr-1"
  />
);

async function answerAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Wing leading edge"));
  await user.click(screen.getByLabelText("At 1/4 inch"));
  await user.click(screen.getByLabelText("SLD conditions"));
}

beforeEach(() => {
  submitQuizAction.mockReset();
  submitQuizAction.mockResolvedValue(attempt());
});

describe("no partial submits", () => {
  it("keeps Submit disabled until every question is answered", async () => {
    const user = userEvent.setup();
    render(runner());
    const submit = screen.getByRole("button", { name: /submit answers/i });

    expect(submit).toBeDisabled();
    await user.click(screen.getByLabelText("Wing leading edge"));
    expect(submit).toBeDisabled();
    await user.click(screen.getByLabelText("At 1/4 inch"));
    expect(submit).toBeDisabled();
    await user.click(screen.getByLabelText("SLD conditions"));
    expect(submit).toBeEnabled();
  });

  it("does not call the server while an answer is missing", async () => {
    const user = userEvent.setup();
    render(runner());
    await user.click(screen.getByLabelText("Wing leading edge"));
    await user.click(screen.getByRole("button", { name: /submit answers/i }));
    expect(submitQuizAction).not.toHaveBeenCalled();
  });

  it("refuses a form submit that bypasses the disabled button", () => {
    // Enter inside a radio group submits the form without going near the
    // button, so the disabled attribute is not the only thing standing
    // between a partial answer set and the server. This covers the guard
    // itself.
    render(runner());
    fireEvent.click(screen.getByLabelText("Wing leading edge"));
    const form = screen.getByRole("button", {
      name: /submit answers/i,
    }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(submitQuizAction).not.toHaveBeenCalled();
  });
});

describe("the payload", () => {
  it("sends option indices in question order", async () => {
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(submitQuizAction).toHaveBeenCalledWith("enr-1", "quiz-1", [1, 1, 0]);
  });

  it("answers questions independently", async () => {
    // Each question is its own radio group. If the grouping were wrong,
    // answering Q2 would clear Q1 and the payload would carry a null.
    const user = userEvent.setup();
    render(runner());
    await user.click(screen.getByLabelText("Windshield")); // Q1 -> 0
    await user.click(screen.getByLabelText("Never")); // Q2 -> 2
    await user.click(screen.getByLabelText("Fog")); // Q3 -> 3
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(submitQuizAction).toHaveBeenCalledWith("enr-1", "quiz-1", [0, 2, 3]);
  });

  it("sends the last choice when an answer is changed", async () => {
    const user = userEvent.setup();
    render(runner());
    await user.click(screen.getByLabelText("Windshield"));
    await user.click(screen.getByLabelText("Wing leading edge")); // changed
    await user.click(screen.getByLabelText("At 1/4 inch"));
    await user.click(screen.getByLabelText("SLD conditions"));
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(submitQuizAction).toHaveBeenCalledWith("enr-1", "quiz-1", [1, 1, 0]);
  });
});

describe("the result comes from the server, not the client", () => {
  it("reports a pass exactly as the server called it", async () => {
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/Passed/);
    expect(status).toHaveTextContent(/3 of 3 correct \(100%\)/);
  });

  it("reports a fail even when every answer looked right locally", async () => {
    // The client has no idea which option is correct until the server
    // says so. If this ever started passing on client-side reasoning, a
    // learner could be issued a certificate they did not earn.
    submitQuizAction.mockResolvedValue(
      attempt({
        score: 1,
        is_pass: false,
        per_question: [
          pq({ question_id: "q-a", ordinal: 1, chosen_index: 1, correct_index: 1 }),
          pq({
            question_id: "q-b",
            ordinal: 2,
            chosen_index: 1,
            correct_index: 3,
            is_correct: false,
          }),
          pq({
            question_id: "q-c",
            ordinal: 3,
            chosen_index: 0,
            correct_index: 2,
            is_correct: false,
          }),
        ],
      }),
    );
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/Not passing yet/);
    expect(status).toHaveTextContent(/1 of 3 correct \(33%\)/);
    expect(status).toHaveTextContent(/≥ 80%/);
  });

  it("shows the correct answer only on the questions that were missed", async () => {
    submitQuizAction.mockResolvedValue(
      attempt({
        score: 2,
        is_pass: false,
        per_question: [
          pq({ question_id: "q-a", ordinal: 1, chosen_index: 1, correct_index: 1 }),
          pq({
            question_id: "q-b",
            ordinal: 2,
            chosen_index: 0,
            correct_index: 1,
            is_correct: false,
            explanation: "Wait for measurable accretion before cycling.",
          }),
          pq({ question_id: "q-c", ordinal: 3, chosen_index: 0, correct_index: 0 }),
        ],
      }),
    );
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    const items = await screen.findAllByRole("listitem");
    const missed = items.find((li) => /Boot cycling/.test(li.textContent ?? ""));
    expect(missed).toBeDefined();
    expect(within(missed!).getByText(/Correct answer: At 1\/4 inch/)).toBeInTheDocument();
    expect(
      within(missed!).getByText(/Wait for measurable accretion/),
    ).toBeInTheDocument();

    const right = items.find((li) => /First indication/.test(li.textContent ?? ""));
    expect(within(right!).queryByText(/Correct answer:/)).not.toBeInTheDocument();
  });

  it("matches per-question feedback by id, not by position", async () => {
    // The server is free to return per_question in any order. Pairing by
    // array index instead of question_id would attach each verdict to the
    // wrong prompt — which reads as the learner having missed something
    // they got right.
    submitQuizAction.mockResolvedValue(
      attempt({
        score: 2,
        is_pass: false,
        per_question: [
          pq({
            question_id: "q-c",
            ordinal: 3,
            chosen_index: 1,
            correct_index: 0,
            is_correct: false,
          }),
          pq({ question_id: "q-a", ordinal: 1, chosen_index: 1, correct_index: 1 }),
          pq({ question_id: "q-b", ordinal: 2, chosen_index: 1, correct_index: 1 }),
        ],
      }),
    );
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    const items = await screen.findAllByRole("listitem");
    const missed = items.find((li) => /Correct answer:/.test(li.textContent ?? ""));
    // The miss belongs to q-c, so its prompt must be the freezing-drizzle one.
    expect(missed?.textContent).toMatch(/Freezing drizzle/);
    expect(missed?.textContent).toMatch(/Correct answer: SLD conditions/);
  });
});

describe("retake", () => {
  it("clears the previous answers rather than resubmitting them", async () => {
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));
    await screen.findByRole("status");

    await user.click(screen.getByRole("button", { name: /retake/i }));

    // Back on the form, nothing selected, Submit locked again.
    expect(screen.getByRole("button", { name: /submit answers/i })).toBeDisabled();
    for (const r of screen.getAllByRole("radio")) {
      expect(r).not.toBeChecked();
    }
  });
});

describe("failure handling", () => {
  it("surfaces the server's message and stays on the form", async () => {
    submitQuizAction.mockResolvedValue({
      status: "error",
      message: "This quiz is no longer available.",
    });
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no longer available/,
    );
    // Crucially: no result view, so nothing claims a pass.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit answers/i }),
    ).toBeInTheDocument();
  });

  it("does not show a result when the action returns ok with no attempt", async () => {
    submitQuizAction.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(runner());
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
