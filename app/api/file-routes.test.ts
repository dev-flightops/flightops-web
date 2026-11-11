import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

import { POST as reportMediaProgress } from "./academy/enrollments/[enrollmentId]/media-progress/route";
import { GET as lessonMedia } from "./academy/media/[mediaId]/route";
import { GET as documentDownload } from "./documents/[documentId]/download/route";
import { GET as versionDownload } from "./documents/[documentId]/versions/[versionNumber]/download/route";
import { GET as drugAlcoholFile } from "./drug-alcohol/files/[fileId]/download/route";
import { GET as employeeDocumentDownload } from "./employee-documents/[documentId]/download/route";
import { GET as gseDocument } from "./gse-documents/[documentId]/route";
import { GET as rampPhoto } from "./ramp-photos/[photoId]/route";
import { GET as safetyReportAttachment } from "./safety-reports/[id]/attachment/route";
import { GET as villagePhoto } from "./village-photos/[photoId]/route";

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
    name: "lesson media",
    handler: lessonMedia as Handler,
    params: { mediaId: "m-1" },
    backend: "https://gw.example/academy/lesson-media/m-1/file",
  },
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
  {
    name: "equipment document",
    handler: gseDocument as Handler,
    params: { documentId: "g-1" },
    backend: "https://gw.example/ground/gse/documents/g-1/file",
  },
  {
    name: "drug and alcohol test document",
    handler: drugAlcoholFile as Handler,
    params: { fileId: "f-1" },
    backend: "https://gw.example/drug-alcohol/files/f-1/download",
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
  const route = ROUTES[4];

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

describe("equipment document (#134)", () => {
  const route = ROUTES.find((r) => r.name === "equipment document")!;

  it("is a download, never sniffed", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-", { status: 200, headers: { "Content-Type": "application/pdf" } }));
    const res = await call(route);
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("says a missing document plainly", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await call(route);
    expect(await res.text()).toBe("That document is no longer on file.");
  });
});

describe("employee document", () => {
  it("keeps personnel files out of shared caches", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    const res = await call(ROUTES[3]);
    expect(res.headers.get("cache-control")).toBe("no-store, private");
  });
});

describe("safety report attachment", () => {
  const route = ROUTES[5];

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

// Kept in the database, never a bucket, so there is no redirect to pass on.
describe("village report photo (#121)", () => {
  const call = () =>
    villagePhoto(new Request("https://app.example/x"), { params: Promise.resolve({ photoId: "v-1" }) });

  it("asks the weather service with the session's token", async () => {
    fetchMock.mockResolvedValue(new Response("jpeg", { status: 200 }));
    await call();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gw.example/weather/village-photos/v-1");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("serves it as the JPEG it is, held a day by this browser alone", async () => {
    fetchMock.mockResolvedValue(new Response("jpeg", { status: 200, headers: { "Content-Type": "text/html" } }));
    const res = await call();
    expect(await res.text()).toBe("jpeg");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  it("says a missing photo plainly", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("That photo is no longer on file.");
  });

  it("refuses without a session", async () => {
    auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a lesson's file (#170)", () => {
  const call = (headers: Record<string, string> = {}) =>
    lessonMedia(new Request("https://app.example/x", { headers }), { params: Promise.resolve({ mediaId: "m-1" }) });

  it("passes a video's Range request on, and the part it gets back", async () => {
    fetchMock.mockResolvedValue(
      new Response("ftyp", {
        status: 206,
        headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 4-7/72", "Accept-Ranges": "bytes" },
      }),
    );
    const res = await call({ Range: "bytes=4-7" });
    expect(fetchMock.mock.calls[0][1].headers.Range).toBe("bytes=4-7");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 4-7/72");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("video/mp4");
  });

  it("never lets the browser guess the type or keep a copy", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    const res = await call();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock.mock.calls[0][1].headers.Range).toBeUndefined();
  });
});

describe("a lesson's progress report (#170)", () => {
  const call = (body = '{"media_id":"m-1","page":1}') =>
    reportMediaProgress(new Request("https://app.example/x", { method: "POST", body }), {
      params: Promise.resolve({ enrollmentId: "e-1" }),
    });

  it("goes to the service as the signed-in user, and the answer comes back", async () => {
    fetchMock.mockResolvedValue(new Response('{"finished":true}', { status: 200 }));
    const res = await call();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gw.example/academy/enrollments/e-1/media-progress");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBe('{"media_id":"m-1","page":1}');
    expect(await res.json()).toEqual({ finished: true });
  });

  it("passes on a refusal", async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"not_enrollee"}', { status: 403 }));
    expect((await call()).status).toBe(403);
  });

  it("no session, no report", async () => {
    auth.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
