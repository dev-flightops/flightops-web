import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { NewCourseForm } from "./new-course-form";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

export default async function NewCoursePage() {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (![...roles].some((r) => ADMIN_ROLES.has(r))) {
    redirect("/academy");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/academy/manage" className="hover:text-foreground">
            ← Manage courses
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          New Course
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Give it a title + description; add lessons once it&rsquo;s
          created. The course won&rsquo;t appear in the public catalog
          until it has lessons.
        </p>
      </header>
      <NewCourseForm />
    </div>
  );
}
