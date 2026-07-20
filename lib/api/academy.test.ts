import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  completeLesson,
  createCourse,
  createLesson,
  deleteLesson,
  enrol,
  getCourse,
  getEnrollment,
  listCourses,
  listEnrollments,
  listMyEnrollments,
  updateCourse,
  updateLesson,
} from "./academy";

const mockedApiFetch = vi.mocked(apiFetch);

describe("academy API client", () => {
  // ---- Courses -----------------------------------------------------------

  it("listCourses composes q + category filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCourses({ q: "icing", category: "safety", include_inactive: true });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/academy/courses?q=icing&category=safety&include_inactive=true",
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
    await createCourse({ title: "Refresher", category: "recurrent" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses", {
      method: "POST",
      body: JSON.stringify({ title: "Refresher", category: "recurrent" }),
    });
  });

  it("updateCourse PATCHes", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateCourse("c-1", { is_active: false });
    expect(mockedApiFetch).toHaveBeenCalledWith("/academy/courses/c-1", {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
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
});
