import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  COURSE_CATEGORY_LABELS,
  type CourseDetail,
  getCourse,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { CourseEditor } from "./course-editor";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

export default async function ManageCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { courseId } = await params;
  const { created } = await searchParams;

  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (![...roles].some((r) => ADMIN_ROLES.has(r))) {
    redirect("/academy");
  }

  let course: CourseDetail;
  try {
    course = await getCourse(courseId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/academy/manage" className="hover:text-foreground">
            ← Manage courses
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {course.title}
          <span className="text-sm font-normal text-muted-foreground">
            {COURSE_CATEGORY_LABELS[course.category]}
          </span>
        </h1>
      </header>

      {created === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Course created. Add lessons below.
        </div>
      ) : null}

      <CourseEditor course={course} />
    </div>
  );
}
