import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  addQuizQuestion,
  completeLesson,
  createCourse,
  createLesson,
  createLessonQuiz,
  deleteLesson,
  deleteQuiz,
  enrol,
  getAdminQuiz,
  getCertificate,
  getCourse,
  getEnrollment,
  getLearnerQuiz,
  listCertificates,
  listCourses,
  listEnrollments,
  listMyCertificates,
  listMyEnrollments,
  listMyQuizAttempts,
  submitQuizAttempt,
  updateCourse,
  updateLesson,
} from "./academy";

const mockedApiFetch = vi.mocked(apiFetch);

describe("academy API client", () => {
  // ---- Courses -----------------------------------------------------------

  it("listCourses composes q + category + status filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCourses({
      q: "icing",
      category: "safety",
      publish_status: "published",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/courses?q=icing&category=safety&publish_status=published",
    );
  });

  it("listCourses forwards include_all_statuses (Studio view)", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCourses({ include_all_statuses: true });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/courses?include_all_statuses=true",
    );
  });

  it("listCourses omits ? when no filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCourses();
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses");
  });

  it("getCourse interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getCourse("c-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses/c-1");
  });

  it("createCourse POSTs the body", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await createCourse({ title: "Refresher", category: "flight_operations" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses", {
      method: "POST",
      body: JSON.stringify({
        title: "Refresher",
        category: "flight_operations",
      }),
    });
  });

  it("updateCourse PATCHes publish_status", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateCourse("c-1", { publish_status: "archived" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses/c-1", {
      method: "PATCH",
      body: JSON.stringify({ publish_status: "archived" }),
    });
  });

  // ---- Lessons -----------------------------------------------------------

  it("createLesson posts under the course", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await createLesson("c-1", { title: "Lesson 1" });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/courses/c-1/lessons",
      {
        method: "POST",
        body: JSON.stringify({ title: "Lesson 1" }),
      },
    );
  });

  it("updateLesson PATCHes to the lesson id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateLesson("l-1", { title: "Updated" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/lessons/l-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
  });

  it("deleteLesson DELETEs", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined as never);
    await deleteLesson("l-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/lessons/l-1", {
      method: "DELETE",
    });
  });

  // ---- Enrollments -------------------------------------------------------

  it("enrol POSTs to /enrollments", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await enrol({ course_id: "c-1" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/enrollments", {
      method: "POST",
      body: JSON.stringify({ course_id: "c-1" }),
    });
  });

  it("listEnrollments composes filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listEnrollments({ course_id: "c-1", status: "completed" });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/enrollments?course_id=c-1&status=completed",
    );
  });

  it("listMyEnrollments hits /mine", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listMyEnrollments();
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/enrollments/mine");
  });

  it("getEnrollment interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getEnrollment("e-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/enrollments/e-1");
  });

  it("completeLesson POSTs the lesson_id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await completeLesson("e-1", "l-2");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/enrollments/e-1/complete-lesson",
      {
        method: "POST",
        body: JSON.stringify({ lesson_id: "l-2" }),
      },
    );
  });

  // ---- Quizzes + certificates --------------------------------------------
  //
  // These paths carried a doubled `/academy/academy` until
  // flightops-services#166 moved the routers off their redundant prefix.
  // Nothing here asserted a quiz or certificate path at all, which is
  // how the doubled form survived as long as it did — every existing
  // test above covers courses, lessons or enrollments, all of which sat
  // at the correct single prefix and so looked fine.
  //
  // The point of these is the prefix, not the interpolation.

  it("getLearnerQuiz uses a single /academy prefix", async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    await getLearnerQuiz("e-1", "q-1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/enrollments/e-1/quizzes/q-1",
    );
  });

  it("submitQuizAttempt POSTs the answers to the single-prefix path", async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    await submitQuizAttempt("e-1", "q-1", [0, 2]);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/enrollments/e-1/quizzes/q-1/attempts",
      { method: "POST", body: JSON.stringify({ answers: [0, 2] }) },
    );
  });

  it("listMyQuizAttempts GETs the same path it posts to", async () => {
    mockedApiFetch.mockResolvedValueOnce([]);
    await listMyQuizAttempts("e-1", "q-1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/enrollments/e-1/quizzes/q-1/attempts",
    );
  });

  it("createLessonQuiz posts under the lesson", async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    await createLessonQuiz("l-1", { title: "SMS Basics", pass_threshold: 70 });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/lessons/l-1/quiz",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getAdminQuiz / deleteQuiz / addQuizQuestion all sit under /academy/quizzes", async () => {
    mockedApiFetch.mockResolvedValue({});
    await getAdminQuiz("q-1");
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/academy/quizzes/q-1");

    await deleteQuiz("q-1");
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/academy/quizzes/q-1", {
      method: "DELETE",
    });

    await addQuizQuestion("q-1", {
      prompt: "p",
      options: ["a", "b"],
      correct_option_index: 0,
    });
    expect(mockedApiFetch).toHaveBeenLastCalledWith(
      "/academy/quizzes/q-1/questions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("certificate reads use a single /academy prefix", async () => {
    mockedApiFetch.mockResolvedValue({ items: [], total: 0 });
    await listMyCertificates();
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/academy/certificates/mine");

    await listCertificates();
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/academy/certificates");

    mockedApiFetch.mockResolvedValueOnce({});
    await getCertificate("cert-1");
    expect(mockedApiFetch).toHaveBeenLastCalledWith("/academy/certificates/cert-1");
  });

  it("no academy path is ever doubled", async () => {
    // A guard over the whole module rather than one call: the doubled
    // form is what someone reaches for first when debugging a 404 here.
    mockedApiFetch.mockResolvedValue({ items: [], total: 0 });
    mockedApiFetch.mockClear();

    await listCourses();
    await listMyEnrollments();
    await getLearnerQuiz("e-1", "q-1");
    await getAdminQuiz("q-1");
    await listMyCertificates();

    const paths = mockedApiFetch.mock.calls.map((c) => String(c[0]));
    expect(paths.length).toBe(5);
    for (const path of paths) {
      expect(path.startsWith("/academy/")).toBe(true);
      expect(path).not.toContain("/academy/academy");
    }
  });
});
