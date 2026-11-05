/**
 * The lesson player reports how far a learner has got through a video or PDF
 * (#170). A route rather than a server action: it fires every few seconds
 * while a video plays, and server actions run one at a time and would hold up
 * a click on a link, and it has to work with `keepalive` as the page closes.
 */

import { auth } from "@/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { enrollmentId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetch(
    `${apiUrl}/academy/enrollments/${enrollmentId}/media-progress`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    },
  );
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
