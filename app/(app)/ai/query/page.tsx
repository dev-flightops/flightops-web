import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getQueryEntities } from "@/lib/api/ai";
import { hasAnyRole, roleGate } from "@/lib/roles";

import { QueryChat } from "./query-chat";

/**
 * /ai/query — Intelligence Query.
 *
 * Legacy's route, kept. Gated to the same shape of audience the
 * service enforces: this one can aggregate booking values across the
 * whole operation, so it sits with the executive reports rather than
 * with the dispatch tools.
 *
 * The gate here is about not rendering a page someone cannot use —
 * the service is what actually enforces it.
 */

const QUERY_READERS = roleGate(
  "exec_admin",
  "director_of_operations",
  "chief_pilot",
);

export const dynamic = "force-dynamic";

export default async function AiQueryPage() {
  const session = await auth();
  // session.roles, not session.user.roles — the latter is undefined.
  if (!hasAnyRole(session?.roles ?? [], QUERY_READERS)) {
    redirect("/home/");
  }

  // The catalogue is a help panel, not the page. If the service is
  // unreachable the box still works and the question still fails
  // honestly.
  const entities = await getQueryEntities().catch(() => []);

  return <QueryChat entities={entities} />;
}
