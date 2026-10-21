import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { hasAnyRole, roleGate } from "@/lib/roles";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { NewCourseForm } from "./new-course-form";

const ADMIN_ROLES = roleGate(
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

export default async function NewCoursePage() {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (!hasAnyRole([...roles], ADMIN_ROLES)) {
    redirect("/academy");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/academy/studio" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Studio
        </Link>
        <h1 className="mt-2 page-title">
          New Course
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Give it a title + description; add lessons once it&rsquo;s
          created. The course won&rsquo;t appear in the public catalog
          until it has lessons.
        </p>
      </header>
      <NewCourseForm />
    </div>
  );
}
