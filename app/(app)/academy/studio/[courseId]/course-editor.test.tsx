import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({
  addLessonAction: vi.fn(), attachQuizAction: vi.fn(), deleteLessonAction: vi.fn(),
  updateComplianceLinkAction: vi.fn(), updatePublishStatusAction: vi.fn(), updateLessonAction: vi.fn(),
}));
import type { CourseDetail } from "@/lib/api/academy";
vi.mock("@/lib/api/academy", () => ({ COURSE_PUBLISH_STATUSES: ["draft", "published", "archived"], COURSE_PUBLISH_STATUS_LABELS: { draft:"Draft", published:"Published", archived:"Archived" } }));
import { CourseEditor } from "./course-editor";
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false] }));
const course: CourseDetail = { id:"c1", title:"Synthetic UAT", description:null, category:"general", publish_status:"draft", is_active:false, cert_valid_days:365, linked_currency_item_id:null, lesson_count:0, duration_minutes:null, passing_score:null, enrollment_count:0, created_at:"2026-11-02T07:00:00Z", updated_at:"2026-11-02T07:00:00Z", lessons:[] };
it("reconciles publication controls to persisted status after save", () => {
  const { rerender } = render(<CourseEditor course={course} eligibleCurrencyItems={[]} />);
  expect(screen.getByRole("combobox", { name:"Publish status" })).toHaveValue("draft");
  rerender(<CourseEditor course={{...course,publish_status:"published",is_active:true,lesson_count:1,lessons:[{id:"l1",course_id:"c1",title:"Read me",body_markdown:"Read this lesson",ordinal:1,quiz_id:null,created_at:course.created_at,updated_at:course.updated_at}]}} eligibleCurrencyItems={[]} />);
  expect(screen.getByRole("combobox", { name:"Publish status" })).toHaveValue("published");
  expect(screen.getByText("Visible in the public catalog.")).toBeInTheDocument();
});
it("keeps an empty draft from being published through the editor", () => {
  render(<CourseEditor course={course} eligibleCurrencyItems={[]} />);
  expect(screen.getByRole("option", { name:"Published" })).toBeDisabled();
  expect(screen.getByText("Add a lesson before publishing or assigning this course.")).toBeInTheDocument();
});
