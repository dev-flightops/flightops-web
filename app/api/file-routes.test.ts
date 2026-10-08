import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

import { GET as documentDownload } from "./documents/[documentId]/download/route";
import { GET as versionDownload } from "./documents/[documentId]/versions/[versionNumber]/download/route";
import { GET as employeeDocumentDownload } from "./employee-documents/[documentId]/download/route";
import { GET as rampPhoto } from "./ramp-photos/[photoId]/route";
import { GET as safetyReportAttachment } from "./safety-reports/[id]/attachment/route";

/**
 * The route handlers that hand a backend file to the browser.
 *
 * In production the file is in a bucket and the service answers with a
 * 302 to a five-minute link. The handler must pass that on rather than
 * treat it as an error (it is not `ok`) or follow it and stream the bytes
 * through a function that cannot return more than 4.5 MB.
 */

const BUCKET_LINK =
  "https://acct.r2.cloudflarestorage.com/flightops-uploads/documents/t1/abc_gom.pdf?X-Amz-Signature=x";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const ROUTES: { name: string; handler: Handler; params: Record<string, string>; backend: string }[] = [
  {
    name: "document",
    handler: documentDownload as Handler,
    params: { documentId: "d-1" },
    backend: "https://gw.example/documents/d-1/download",
  },
  {
    name: "document version",
    handler: versionDownload as Handler,
    params: { documentId: "d-1", versionNumber: "3" },
    backend: "https://gw.example/documents/d-1/versions/3/download",
  },
  {
    name: "employee document",
    handler: employeeDocumentDownload as Handler,
    params: { documentId: "e-1" },
    backend: "https://gw.example/employee-documents/e-1/download",
  },
  {
    name: "ramp photo",
    handler: rampPhoto as Handler,
    params: { photoId: "p-1" },
    backend: "https://gw.example/ground/photos/p-1/file",
  },
  {
    name: "safety report attachment",
    handler: safetyReportAttachment as Handler,
    params: { id: "r-1" },
    backend: "https://gw.example/safety/reports/r-1/attachment",
  },
];

const fetchMock = vi.fn();

function call(route: (typeof ROUTES)[number]) {
  return route.handler(new Request("https://app.example/x"), {
    params: Promise.resolve(route.params),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://gw.example");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  auth.mockResolvedValue({ access_token: "tok" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(ROUTES)("$name", (route) => {
  it("asks the backend with the session's token and does not follow redirects", async () => {
    fetchMock.mockResolvedValue(new Response("bytes", { status: 200 }));
    await call(route);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(route.backend);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.redirect).toBe("manual");
  });

  it("passes a bucket redirect to the browser", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: BUCKET_LINK } }),
    );
    const res = await call(route);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(BUCKET_LINK);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("streams a local file with the backend's headers", async () => {
    fetchMock.mockResolvedValue(
      new Response("file-bytes", {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Disposition": 'inline; filename="p.jpg"',
        },
      }),
    );
    const res = await call(route);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("file-bytes");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="p.jpg"');
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });

  it.each([403, 404])("keeps a %i a %i", async (status) => {
    fetchMock.mockResolvedValue(new Response("nope", { status }));
    const res = await call(route);
    expect(res.status).toBe(status);
  });

  it("refuses without a session", async () => {
    auth.mockResolvedValue(null);
    const res = await call(route);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ramp photo", () => {
  const route = ROUTES[3];

  it("tells the browser never to guess the type", async () => {
    fetchMock.mockResolvedValue(
      new Response("x", { status: 200, headers: { "Content-Type": "image/png" } }),
    );
    const res = await call(route);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("says a missing photo plainly", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await call(route);
    expect(await res.text()).toBe("That photo is no longer on file.");
  });
});

describe("employee document", () => {
  it("keeps personnel files out of shared caches", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    const res = await call(ROUTES[2]);
    expect(res.headers.get("cache-control")).toBe("no-store, private");
  });
});

describe("safety report attachment", () => {
  const route = ROUTES[4];

  it("tells the browser never to guess the type", async () => {
    fetchMock.mockResolvedValue(
      new Response("%PDF-", { status: 200, headers: { "Content-Type": "application/pdf" } }),
    );
    const res = await call(route);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("says a missing attachment plainly", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await call(route);
    expect(await res.text()).toBe("That attachment is no longer on file.");
  });
});
