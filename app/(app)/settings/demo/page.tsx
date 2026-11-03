import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ff/page-header";
import { getDemoStatus } from "@/lib/api/demo";
import { DemoForm } from "./demo-form";

// Preparing again first removes the last examples: about 26 seconds on a
// copy of the demo (3 Nov), longer than a function runs by default.
export const maxDuration = 60;

export default async function DemoPage() {
  const status = await getDemoStatus();
  if (!status.enabled) notFound();
  return <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6"><PageHeader back={{ href: "/settings", label: "Settings" }} title="Prepare today’s demo" /><DemoForm status={status} /></div>;
}
