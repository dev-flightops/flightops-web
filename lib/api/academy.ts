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

export type LessonMediaKind = "image" | "video" | "pdf";

/** A picture, video or PDF in a lesson (#170): uploaded here, a video link,
 *  or a document from the library. */
export interface LessonMedia {
  id: string;
  lesson_id: string;
  ordinal: number;
  kind: LessonMediaKind;
  title: string;
  /** Whether the learner has to watch it or page it to the end before the
   *  lesson can complete. Off, it's for reference. */
  must_finish: boolean;
  source: "file" | "link" | "document";
  filename: string | null;
  size_bytes: number | null;
  link_url: string | null;
  link_provider: "youtube" | "vimeo" | "file" | null;
  /** The provider's id for the video; for an unlisted Vimeo video, "id/hash". */
  link_ref: string | null;
  document_id: string | null;
}

/** How far a learner has got through one video or PDF. */
export interface LessonMediaProgress {
  media_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  page: number;
  page_count: number | null;
  finished: boolean;
  finished_at: string | null;
}

export interface LessonMediaLimits {
  direct_uploads: boolean;
  max_bytes: Record<LessonMediaKind, number>;
}

export interface LessonMediaLibraryItem {
  document_id: string;
  title: string;
  category: string;
  kind: LessonMediaKind;
}

export interface LessonMediaUploadTicket {
  file_key: string;
  url: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface Lesson {
  id: string;
  course_id: string;
  ordinal: number;
  title: string;
  body_markdown: string;
  /** Its pictures, videos and PDFs, in order (#170). */
  media: LessonMedia[];
  /** Backend surfaces the quiz attached to this lesson (or null).
   *  When set, complete-lesson is quiz-gated — the frontend Quiz
   *  Runner has to hand the enrollee through a passing attempt
   *  before Mark Complete succeeds. */
  quiz_id: string | null;
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
  /** Compliance-link (Spec 5). When set, completing the course auto-
   *  files a currency completion for this item via the shared
   *  writeback helper. Backend rejects rolling-days + check-event
   *  items on link — only calendar-month items are eligible. */
  linked_currency_item_id: string | null;
  lesson_count: number;
  /** HALT-2 card metadata. `duration_minutes` is stored; the other two
   *  are derived server-side.
   *
   *  `passing_score` is null both when a course has no quizzes AND when
   *  its quizzes disagree on a threshold — we grade per quiz, so there
   *  is no single honest number to show. Render nothing in that case
   *  rather than substituting a default. */
  duration_minutes: number | null;
  passing_score: number | null;
  enrollment_count: number;
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
  linked_currency_item_id?: string | null;
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
  /** Pass `null` to unlink; pass an item id to bind. Backend 4xxs
   *  if the item is rolling-days, a check event, or inactive. */
  linked_currency_item_id?: string | null;
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

export async function getLessonMediaLimits(): Promise<LessonMediaLimits> {
  return apiFetch<LessonMediaLimits>("/academy/lesson-media/upload-limits");
}

export async function listLessonMediaLibrary(): Promise<LessonMediaLibraryItem[]> {
  const { items } = await apiFetch<{ items: LessonMediaLibraryItem[] }>(
    "/academy/lesson-media/library",
  );
  return items;
}

/** A file small enough to come through the service. */
export async function uploadLessonMedia(
  lessonId: string,
  form: FormData,
): Promise<LessonMedia> {
  return apiFetch<LessonMedia>(`/academy/lessons/${lessonId}/media`, {
    method: "POST",
    body: form,
  });
}

/** A URL to send a large file straight to the bucket. */
export async function startLessonMediaUpload(
  lessonId: string,
  input: { filename: string; size_bytes: number },
): Promise<LessonMediaUploadTicket> {
  return apiFetch<LessonMediaUploadTicket>(
    `/academy/lessons/${lessonId}/media/upload-url`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function completeLessonMediaUpload(
  lessonId: string,
  input: {
    file_key: string;
    filename: string;
    title: string | null;
    must_finish: boolean;
  },
): Promise<LessonMedia> {
  return apiFetch<LessonMedia>(`/academy/lessons/${lessonId}/media/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addLessonMediaLink(
  lessonId: string,
  input: { url: string; title: string | null; must_finish: boolean },
): Promise<LessonMedia> {
  return apiFetch<LessonMedia>(`/academy/lessons/${lessonId}/media/link`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addLessonMediaDocument(
  lessonId: string,
  input: { document_id: string; title: string | null; must_finish: boolean },
): Promise<LessonMedia> {
  return apiFetch<LessonMedia>(`/academy/lessons/${lessonId}/media/document`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateLessonMedia(
  mediaId: string,
  input: { title?: string; must_finish?: boolean; move?: "up" | "down" },
): Promise<LessonMedia> {
  return apiFetch<LessonMedia>(`/academy/lesson-media/${mediaId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteLessonMedia(mediaId: string): Promise<void> {
  await apiFetch<void>(`/academy/lesson-media/${mediaId}`, {
    method: "DELETE",
  });
}

/** How far this learner has got through the course's videos and PDFs. */
export async function listLessonMediaProgress(
  enrollmentId: string,
): Promise<LessonMediaProgress[]> {
  const { items } = await apiFetch<{ items: LessonMediaProgress[] }>(
    `/academy/enrollments/${enrollmentId}/media-progress`,
  );
  return items;
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

// ============================================================================
// Quizzes — learner-facing
// ============================================================================

/** Question shape a learner sees. The backend intentionally hides
 *  `correct_option_index` on this view so a learner can't inspect
 *  the answer via the network tab before submitting. */
export interface QuizQuestionLearner {
  id: string;
  ordinal: number;
  prompt: string;
  options: string[];
}

export interface QuizLearnerResponse {
  id: string;
  lesson_id: string;
  title: string;
  instructions: string | null;
  pass_threshold: number;
  questions: QuizQuestionLearner[];
}

/** Per-question detail returned after a submitted attempt. `explanation`
 *  is the teaching material the author left; renders under each
 *  question in the result view. */
export interface QuizAttemptPerQuestion {
  question_id: string;
  ordinal: number;
  chosen_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string | null;
}

export interface QuizAttemptResponse {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  user_id: string;
  answers: number[];
  score: number;
  question_count: number;
  is_pass: boolean;
  submitted_at: string;
  per_question: QuizAttemptPerQuestion[];
}

/** Quiz and certificate routes used to need a doubled `/academy/academy`
 *  here: the routers inside academy-service carried their own `/academy`
 *  prefix on top of the one the nginx gateway rewrites away. Fixed in
 *  flightops-services#166 — they now sit at the same plain paths as
 *  courses, lessons and enrollments, so this is just the gateway prefix
 *  like everything else in this file.
 *
 *  Kept as a named constant rather than inlined because the doubled form
 *  is exactly the kind of thing that gets "helpfully" restored by anyone
 *  debugging a 404 here; the name is where the explanation lives. */
const QUIZ_GATEWAY_PREFIX = "/academy";

export async function getLearnerQuiz(
  enrollmentId: string,
  quizId: string,
): Promise<QuizLearnerResponse> {
  return apiFetch<QuizLearnerResponse>(
    `${QUIZ_GATEWAY_PREFIX}/enrollments/${enrollmentId}/quizzes/${quizId}`,
  );
}

export async function submitQuizAttempt(
  enrollmentId: string,
  quizId: string,
  answers: number[],
): Promise<QuizAttemptResponse> {
  return apiFetch<QuizAttemptResponse>(
    `${QUIZ_GATEWAY_PREFIX}/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`,
    {
      method: "POST",
      body: JSON.stringify({ answers }),
    },
  );
}

/** Every attempt this learner has made against this quiz under this
 *  enrollment (newest first). Used by the lesson-player gate: if
 *  any attempt has `is_pass=true`, Mark Complete is unlocked. */
export async function listMyQuizAttempts(
  enrollmentId: string,
  quizId: string,
): Promise<QuizAttemptResponse[]> {
  return apiFetch<QuizAttemptResponse[]>(
    `${QUIZ_GATEWAY_PREFIX}/enrollments/${enrollmentId}/quizzes/${quizId}/attempts`,
  );
}

// ============================================================================
// Admin quiz authoring (Studio)
// ============================================================================

/** Admin-facing question shape. Includes the correct-option index +
 *  explanation so authors can see + edit what they wrote. Server sorts
 *  by `ordinal` on the read path. */
export interface QuizQuestionAdmin {
  id: string;
  ordinal: number;
  prompt: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
}

/** Full admin view of a quiz: everything the learner sees PLUS the
 *  correct-answer indices + author notes. */
export interface QuizAdminResponse {
  id: string;
  lesson_id: string;
  title: string;
  instructions: string | null;
  pass_threshold: number;
  questions: QuizQuestionAdmin[];
}

export interface QuizCreateInput {
  title: string;
  instructions?: string | null;
  /** Percentage 0–100. Server default is 70 if omitted. */
  pass_threshold?: number;
}

export interface QuizUpdateInput {
  title?: string;
  instructions?: string | null;
  pass_threshold?: number;
}

export interface QuizQuestionCreateInput {
  prompt: string;
  /** 2–6 answer choices. */
  options: string[];
  /** Index into `options` of the correct choice. */
  correct_option_index: number;
  explanation?: string | null;
  /** 1-based insert position; omitted → append at end. */
  ordinal?: number;
}

export interface QuizQuestionUpdateInput {
  prompt?: string;
  options?: string[];
  correct_option_index?: number;
  explanation?: string | null;
  ordinal?: number;
}

/** Create a quiz on the given lesson. Rejects (409) if the lesson
 *  already has a quiz — one quiz per lesson today. */
export async function createLessonQuiz(
  lessonId: string,
  input: QuizCreateInput,
): Promise<QuizAdminResponse> {
  return apiFetch<QuizAdminResponse>(
    `${QUIZ_GATEWAY_PREFIX}/lessons/${lessonId}/quiz`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/** Admin read — includes correct-option indices, so 403 for pilots. */
export async function getAdminQuiz(quizId: string): Promise<QuizAdminResponse> {
  return apiFetch<QuizAdminResponse>(
    `${QUIZ_GATEWAY_PREFIX}/quizzes/${quizId}`,
  );
}

export async function updateQuiz(
  quizId: string,
  input: QuizUpdateInput,
): Promise<QuizAdminResponse> {
  return apiFetch<QuizAdminResponse>(
    `${QUIZ_GATEWAY_PREFIX}/quizzes/${quizId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await apiFetch<void>(`${QUIZ_GATEWAY_PREFIX}/quizzes/${quizId}`, {
    method: "DELETE",
  });
}

export async function addQuizQuestion(
  quizId: string,
  input: QuizQuestionCreateInput,
): Promise<QuizQuestionAdmin> {
  return apiFetch<QuizQuestionAdmin>(
    `${QUIZ_GATEWAY_PREFIX}/quizzes/${quizId}/questions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/** A question is edited and deleted by its own id: the service's routes are
 *  `/academy/questions/{id}`, not nested under the quiz (#15). */
export async function updateQuizQuestion(
  questionId: string,
  input: QuizQuestionUpdateInput,
): Promise<QuizQuestionAdmin> {
  return apiFetch<QuizQuestionAdmin>(
    `${QUIZ_GATEWAY_PREFIX}/questions/${questionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteQuizQuestion(questionId: string): Promise<void> {
  await apiFetch<void>(
    `${QUIZ_GATEWAY_PREFIX}/questions/${questionId}`,
    { method: "DELETE" },
  );
}

// ============================================================================
// Certificates
// ============================================================================

export interface Certificate {
  id: string;
  enrollment_id: string;
  course: CourseRef;
  user: UserRef;
  cert_number: string;
  issued_at: string;
  expires_at: string | null;
}

export interface CertificateListResponse {
  items: Certificate[];
  total: number;
}

export interface ListCertificatesParams {
  user_id?: string;
  course_id?: string;
  limit?: number;
  offset?: number;
}

function _certificatesQs(p: ListCertificatesParams = {}): string {
  const s = new URLSearchParams();
  if (p.user_id) s.set("user_id", p.user_id);
  if (p.course_id) s.set("course_id", p.course_id);
  if (p.limit !== undefined) s.set("limit", String(p.limit));
  if (p.offset !== undefined) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

/** Certificates the caller has earned. Backend: GET
 *  /academy/certificates/mine. Router sits under the doubled
 *  gateway prefix — same reason as the quiz endpoints. */
export async function listMyCertificates(
  params: { limit?: number; offset?: number } = {},
): Promise<CertificateListResponse> {
  const s = new URLSearchParams();
  if (params.limit !== undefined) s.set("limit", String(params.limit));
  if (params.offset !== undefined) s.set("offset", String(params.offset));
  const qs = s.toString();
  return apiFetch<CertificateListResponse>(
    `${QUIZ_GATEWAY_PREFIX}/certificates/mine${qs ? `?${qs}` : ""}`,
  );
}

/** Admin roster of certificates (chief_pilot / exec_admin only).
 *  Backend 403s for pilots. Filter by user_id or course_id. */
export async function listCertificates(
  params: ListCertificatesParams = {},
): Promise<CertificateListResponse> {
  return apiFetch<CertificateListResponse>(
    `${QUIZ_GATEWAY_PREFIX}/certificates${_certificatesQs(params)}`,
  );
}

/** Single-certificate detail. Backend: GET
 *  /academy/certificates/{id}. Any authenticated user can fetch
 *  their own cert; admins can fetch anyone's. */
export async function getCertificate(
  certificateId: string,
): Promise<Certificate> {
  return apiFetch<Certificate>(
    `${QUIZ_GATEWAY_PREFIX}/certificates/${certificateId}`,
  );
}

// ---- Reports ----------------------------------------------------------------
//
// Academy Reports (legacy /lms/reports): the academy service works out the
// figures (its app/reports.py says what each one counts, and where legacy
// can't carry over).

export type AcademyReportKind = "by-employee" | "by-course" | "by-department" | "overdue" | "currency";

/** Which filters a report takes: the From/To dates, the courses' department,
 *  and the people ones (role, base, a person). */
export type AcademyReportFilter = "dates" | "category" | "people";

/** Legacy's five reports, in its order, each with legacy's filters: By
 *  Department has no dates or people, By Course no people, and Overdue and
 *  Currency are as of today. */
export const ACADEMY_REPORTS: readonly {
  key: AcademyReportKind;
  label: string;
  title: string;
  about: string;
  filters: readonly AcademyReportFilter[];
}[] = [
  {
    key: "by-employee",
    label: "By Employee",
    title: "Completion by Employee",
    about: "Each person's training: courses assigned, completed and overdue, and their average quiz score.",
    filters: ["dates", "category", "people"],
  },
  {
    key: "by-course",
    label: "By Course",
    title: "Completion by Course",
    about: "Each published course: how many have it, how many completed it, and how its quiz went.",
    filters: ["dates", "category"],
  },
  {
    key: "by-department",
    label: "By Department",
    title: "Completion by Department",
    about: "Completion rates by the courses' department, to see which ones are lagging.",
    filters: ["category"],
  },
  {
    key: "overdue",
    label: "Overdue Training",
    title: "Overdue Training",
    about: "Training whose certificate has run out without being renewed, the longest overdue first.",
    filters: ["category", "people"],
  },
  {
    key: "currency",
    label: "Training Currency",
    title: "Training Currency",
    about: "Each person against each course whose certificate expires: when they last completed it, when it runs out, and how long is left.",
    filters: ["category", "people"],
  },
];

export interface AcademyReportParams {
  from?: string;
  to?: string;
  category?: CourseCategory;
  role?: string;
  base?: string;
  user_id?: string;
}

const REPORT_PARAMS = ["from", "to", "category", "role", "base", "user_id"] as const;

/** "?from=…&role=…" for the filters that are set, or "". */
export function academyReportQs(p: AcademyReportParams): string {
  const s = new URLSearchParams();
  for (const key of REPORT_PARAMS) {
    const v = p[key];
    if (v) s.set(key, v);
  }
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

export interface AcademyReportFilterOptions {
  roles: string[];
  bases: string[];
  people: { id: string; full_name: string }[];
}

export interface EmployeeReportRow {
  user_id: string;
  full_name: string;
  department: string | null;
  base: string | null;
  assigned: number;
  completed: number;
  overdue: number;
  avg_score: number | null;
}

export interface CourseReportRow {
  course_id: string;
  title: string;
  category: CourseCategory;
  assigned: number;
  completed: number;
  /** Null when the course has no quiz: nothing to pass. */
  passed: number | null;
  pass_rate: number | null;
  avg_score: number | null;
}

export interface DepartmentReportRow {
  category: CourseCategory;
  courses: number;
  assigned: number;
  completed: number;
  overdue: number;
  completion_rate: number;
}

export interface OverdueReportRow {
  user_id: string;
  full_name: string;
  course_id: string;
  title: string;
  category: CourseCategory;
  expired_on: string;
  days_overdue: number;
}

export type CurrencyStatus = "expired" | "due_soon" | "current" | "never";

export const CURRENCY_STATUS_LABELS: Record<CurrencyStatus, string> = {
  expired: "Expired",
  due_soon: "Due soon",
  current: "Current",
  never: "Never",
};

export interface CurrencyReportRow {
  user_id: string;
  full_name: string;
  course_id: string;
  title: string;
  category: CourseCategory;
  cert_valid_days: number;
  last_completed: string | null;
  expires_on: string | null;
  days_left: number | null;
  status: CurrencyStatus;
}

export interface AcademyReportRows {
  "by-employee": EmployeeReportRow;
  "by-course": CourseReportRow;
  "by-department": DepartmentReportRow;
  overdue: OverdueReportRow;
  currency: CurrencyReportRow;
}

export interface AcademyReport<K extends AcademyReportKind> {
  as_of: string;
  rows: AcademyReportRows[K][];
}

/** Chief Pilot, Director of Operations and Exec Admin; 403 for others. */
export async function getAcademyReport<K extends AcademyReportKind>(
  kind: K,
  params: AcademyReportParams = {},
): Promise<AcademyReport<K>> {
  return apiFetch<AcademyReport<K>>(`/academy/reports/${kind}${academyReportQs(params)}`);
}

export async function getAcademyReportFilterOptions(): Promise<AcademyReportFilterOptions> {
  return apiFetch<AcademyReportFilterOptions>("/academy/reports/filters");
}

export async function getAcademyReportCsv(
  kind: AcademyReportKind,
  params: AcademyReportParams = {},
): Promise<string> {
  return apiFetch<string>(`/academy/reports/${kind}/csv${academyReportQs(params)}`, { parseAs: "text" });
}
