/**
 * Typed wrappers around academy-service endpoints (M3 slice 1).
 *
 * Backend: services/academy/app/routes/{courses,enrollments}.py
 */

import { apiFetch } from "./client";

// ============================================================================
// Types
// ============================================================================

/**
 * 10 operational categories matching legacy peregrineflight's Course
 * Library sidebar. Category order below is display order in the
 * sidebar — legacy groups operational-first (Flight Ops / Dispatch /
 * Maintenance) before broader ones (Records / Admin / General).
 */
export type CourseCategory =
  | "flight_operations"
  | "dispatch"
  | "maintenance"
  | "safety"
  | "compliance"
  | "ground_operations_ramp"
  | "customer_service"
  | "records"
  | "administration"
  | "general";

export const COURSE_CATEGORIES: readonly CourseCategory[] = [
  "flight_operations",
  "dispatch",
  "maintenance",
  "safety",
  "compliance",
  "ground_operations_ramp",
  "customer_service",
  "records",
  "administration",
  "general",
] as const;

export const COURSE_CATEGORY_LABELS: Record<CourseCategory, string> = {
  flight_operations: "Flight Operations",
  dispatch: "Dispatch",
  maintenance: "Maintenance",
  safety: "Safety",
  compliance: "Compliance",
  ground_operations_ramp: "Ground Operations / Ramp",
  customer_service: "Customer Service",
  records: "Records",
  administration: "Administration",
  general: "General — Company Wide",
};

export type CoursePublishStatus = "draft" | "published" | "archived";

export const COURSE_PUBLISH_STATUSES: readonly CoursePublishStatus[] = [
  "draft",
  "published",
  "archived",
] as const;

export const COURSE_PUBLISH_STATUS_LABELS: Record<CoursePublishStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export type EnrollmentStatus = "in_progress" | "completed" | "expired";

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  in_progress: "In Progress",
  completed: "Completed",
  expired: "Expired",
};

export interface Lesson {
  id: string;
  course_id: string;
  ordinal: number;
  title: string;
  body_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  category: CourseCategory;
  publish_status: CoursePublishStatus;
  // Convenience mirror of `publish_status === 'published'`. Backend
  // computes + returns both so the catalog card can render a
  // draft/archived badge without an extra client-side compare.
  is_active: boolean;
  cert_valid_days: number;
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

export interface CourseDetail extends Course {
  lessons: Lesson[];
}

export interface CourseListResponse {
  items: Course[];
  total: number;
}

export interface UserRef {
  id: string;
  full_name: string;
  email: string;
}

export interface CourseRef {
  id: string;
  title: string;
  category: CourseCategory;
}

export interface LessonCompletionRef {
  id: string;
  lesson_id: string;
  completed_at: string;
}

export interface Enrollment {
  id: string;
  course: CourseRef;
  user: UserRef;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  expires_at: string | null;
  total_lessons: number;
  completed_lessons: number;
  completions: LessonCompletionRef[];
  created_at: string;
  updated_at: string;
}

export interface EnrollmentListResponse {
  items: Enrollment[];
  total: number;
}

// ============================================================================
// Courses
// ============================================================================

export interface ListCoursesParams {
  q?: string;
  category?: CourseCategory;
  publish_status?: CoursePublishStatus;
  include_all_statuses?: boolean;
  limit?: number;
  offset?: number;
}

function _coursesQs(p: ListCoursesParams): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.category) s.set("category", p.category);
  if (p.publish_status) s.set("publish_status", p.publish_status);
  if (p.include_all_statuses) s.set("include_all_statuses", "true");
  if (p.limit !== undefined) s.set("limit", String(p.limit));
  if (p.offset !== undefined) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

export async function listCourses(
  params: ListCoursesParams = {},
): Promise<CourseListResponse> {
  return apiFetch<CourseListResponse>(`/academy/courses${_coursesQs(params)}`);
}

export async function getCourse(courseId: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/academy/courses/${courseId}`);
}

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  category?: CourseCategory;
  cert_valid_days?: number;
  publish_status?: CoursePublishStatus;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  return apiFetch<Course>("/academy/courses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateCourseInput {
  title?: string;
  description?: string | null;
  category?: CourseCategory;
  cert_valid_days?: number;
  publish_status?: CoursePublishStatus;
}

export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput,
): Promise<Course> {
  return apiFetch<Course>(`/academy/courses/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ============================================================================
// Lessons
// ============================================================================

export interface CreateLessonInput {
  title: string;
  body_markdown?: string;
  ordinal?: number;
}

export async function createLesson(
  courseId: string,
  input: CreateLessonInput,
): Promise<Lesson> {
  return apiFetch<Lesson>(`/academy/courses/${courseId}/lessons`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateLessonInput {
  title?: string;
  body_markdown?: string;
  ordinal?: number;
}

export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
): Promise<Lesson> {
  return apiFetch<Lesson>(`/academy/lessons/${lessonId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await apiFetch<void>(`/academy/lessons/${lessonId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Enrollments
// ============================================================================

export interface EnrolInput {
  course_id: string;
  user_id?: string;
}

export async function enrol(input: EnrolInput): Promise<Enrollment> {
  return apiFetch<Enrollment>("/academy/enrollments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ListEnrollmentsParams {
  course_id?: string;
  user_id?: string;
  status?: EnrollmentStatus;
  limit?: number;
  offset?: number;
}

function _enrollmentsQs(p: ListEnrollmentsParams): string {
  const s = new URLSearchParams();
  if (p.course_id) s.set("course_id", p.course_id);
  if (p.user_id) s.set("user_id", p.user_id);
  if (p.status) s.set("status", p.status);
  if (p.limit !== undefined) s.set("limit", String(p.limit));
  if (p.offset !== undefined) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

export async function listEnrollments(
  params: ListEnrollmentsParams = {},
): Promise<EnrollmentListResponse> {
  return apiFetch<EnrollmentListResponse>(
    `/academy/enrollments${_enrollmentsQs(params)}`,
  );
}

export async function listMyEnrollments(
  params: Pick<ListEnrollmentsParams, "limit" | "offset"> = {},
): Promise<EnrollmentListResponse> {
  return apiFetch<EnrollmentListResponse>(
    `/academy/enrollments/mine${_enrollmentsQs(params)}`,
  );
}

export async function getEnrollment(enrollmentId: string): Promise<Enrollment> {
  return apiFetch<Enrollment>(`/academy/enrollments/${enrollmentId}`);
}

export async function completeLesson(
  enrollmentId: string,
  lessonId: string,
): Promise<Enrollment> {
  return apiFetch<Enrollment>(
    `/academy/enrollments/${enrollmentId}/complete-lesson`,
    {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId }),
    },
  );
}
