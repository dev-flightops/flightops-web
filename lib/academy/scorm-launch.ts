import { auth } from "@/auth";

/**
 * A SCORM run's link, for the lesson's frame (the bug doc's Section 6). The
 * service answers with a path under the API's own address; the package runs
 * there, away from the app and its login, so the frame gets the API's full
 * URL and its origin, which the player trusts its messages from.
 */
export async function scormLaunchResponse(servicePath: string): Promise<Response> {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }
  const response = await fetch(`${apiUrl}${servicePath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const launch = JSON.parse(text) as { path: string; expires_at: string };
  return Response.json(
    {
      // As every call here builds it: the API's address, then the path.
      url: `${apiUrl.replace(/\/$/, "")}${launch.path}`,
      origin: new URL(apiUrl).origin,
      expires_at: launch.expires_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
