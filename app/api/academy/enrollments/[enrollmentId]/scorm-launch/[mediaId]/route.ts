/**
 * The enrollee's own run through a SCORM item (the bug doc's Section 6):
 * started, or picked up where it was left. A route, as media progress is, so
 * a click never waits behind another action.
 */

import { scormLaunchResponse } from "@/lib/academy/scorm-launch";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string; mediaId: string }> },
) {
  const { enrollmentId, mediaId } = await params;
  return scormLaunchResponse(
    `/academy/enrollments/${encodeURIComponent(enrollmentId)}/media/${encodeURIComponent(mediaId)}/scorm-launch`,
  );
}
