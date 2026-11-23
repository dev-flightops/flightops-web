import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getEnrollment, getCourse } = vi.hoisted(() => ({
  getEnrollment: vi.fn(),
  getCourse: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u-1" } }) }));
vi.mock("@/lib/api/academy", () => ({
  COURSE_CATEGORY_LABELS: { flight_operations: "Flight Operations" },
  ENROLLMENT_STATUS_LABELS: { in_progress: "In Progress", completed: "Completed", expired: "Expired" },
  getEnrollment,
  getCourse,
  listLessonMediaProgress: vi.fn(async () => []),
  listMyQuizAttempts: vi.fn(async () => []),
  listScormAttempts: vi.fn(async () => []),
}));
vi.mock("@/lib/api/auth", () => ({
  loadZoneTable: async () => ({ byIcao: {}, fallback: "America/Anchorage" }),
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("./lesson-player", () => ({ LessonPlayer: () => null }));

import EnrollmentLessonPage from "./page";

describe("a finished course's days (#68)", () => {
  it("gives the completion and expiry days in the company's zone, not UTC", async () => {
    getEnrollment.mockResolvedValue({
      id: "e-1",
      course: { id: "c-1", title: "Emergency Procedures — Part 135" },
      user: { id: "u-1" },
      status: "completed",
      completed_lessons: 1,
      total_lessons: 1,
      completions: [{ id: "lc-1", lesson_id: "l-1", completed_at: "2026-11-23T05:30:00Z" }],
      // 20:30 on 22 Nov in Alaska; UTC already reads the 23rd.
      completed_at: "2026-11-23T05:30:00Z",
      expires_at: "2027-11-23T05:30:00Z",
    });
    getCourse.mockResolvedValue({
      id: "c-1",
      title: "Emergency Procedures — Part 135",
      category: "flight_operations",
      lessons: [{ id: "l-1", title: "Engine failure", ordinal: 1, body_markdown: "", quiz_id: null, media: [] }],
    });
    render(
      await EnrollmentLessonPage({
        params: Promise.resolve({ id: "e-1" }),
        searchParams: Promise.resolve({}),
      }),
    );
    const line = screen.getByText(/lessons? complete/);
    expect(line).toHaveTextContent("Completed Nov 22, 2026");
    expect(line).toHaveTextContent("Expires Nov 22, 2027");
    expect(line).not.toHaveTextContent("UTC");
  });
});
