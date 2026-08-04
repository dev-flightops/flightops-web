import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  archiveDocument,
  createDocument,
  downloadUrl,
  getDocument,
  listDocuments,
  updateDocument,
  uploadDocumentVersion,
  versionDownloadUrl,
} from "./documents";

const mockedApiFetch = vi.mocked(apiFetch);

describe("documents API client", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("listDocuments hits the trailing-slash path (nginx location rule)", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], categories: [] });
    await listDocuments();
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/");
  });

  it("listDocuments composes category + include_archived", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], categories: [] });
    await listDocuments({ category: "manuals", includeArchived: true });
    const call = mockedApiFetch.mock.calls[0][0] as string;
    expect(call.startsWith("/documents/?")).toBe(true);
    const qs = new URLSearchParams(call.split("?")[1]);
    expect(qs.get("category")).toBe("manuals");
    expect(qs.get("include_archived")).toBe("true");
  });

  it("getDocument hits the detail path", async () => {
    mockedApiFetch.mockResolvedValueOnce({ document: {}, versions: [] });
    await getDocument("doc-42");
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/doc-42");
  });

  it("createDocument POSTs a JSON payload", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "d1" });
    await createDocument({ title: "Ops Manual", category: "manuals" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/", {
      method: "POST",
      body: JSON.stringify({ title: "Ops Manual", category: "manuals" }),
    });
  });

  it("updateDocument PATCHes only supplied fields", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "d1" });
    await updateDocument("d1", { category: "safety-bulletins" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/d1", {
      method: "PATCH",
      body: JSON.stringify({ category: "safety-bulletins" }),
    });
  });

  it("uploadDocumentVersion POSTs multipart FormData", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "v1", version_number: 2 });
    const form = new FormData();
    form.append("file", new Blob(["hello"]), "hello.txt");
    form.append("notes", "second draft");
    await uploadDocumentVersion("d1", form);
    // Assert on the shape rather than object equality — the FormData
    // instance passes through as-is and would fail deep-equal.
    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(path).toBe("/documents/d1/versions");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("archiveDocument issues DELETE", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);
    await archiveDocument("d1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/d1", {
      method: "DELETE",
    });
  });

  it("downloadUrl points at the same-origin auth-proxy route", () => {
    expect(downloadUrl("d1")).toBe("/api/documents/d1/download");
  });

  it("versionDownloadUrl embeds the version number", () => {
    expect(versionDownloadUrl("d1", 3)).toBe(
      "/api/documents/d1/versions/3/download",
    );
  });
});
