/** The author's own look at a SCORM item from the studio: it runs as for a
 *  learner and counts for nothing (the bug doc's Section 6). */

import { scormLaunchResponse } from "@/lib/academy/scorm-launch";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const { mediaId } = await params;
  return scormLaunchResponse(`/academy/lesson-media/${encodeURIComponent(mediaId)}/scorm-preview`);
}
