import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lesson, LessonMedia, LessonMediaLimits } from "@/lib/api/academy";

const actions = vi.hoisted(() => ({
  addMediaDocumentAction: vi.fn(),
  addMediaFileAction: vi.fn(),
  addMediaLinkAction: vi.fn(),
  completeMediaUploadAction: vi.fn(),
  removeMediaAction: vi.fn(),
  startMediaUploadAction: vi.fn(),
  updateMediaAction: vi.fn(),
}));
const put = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/direct-upload", () => ({
  DirectUploadError: class extends Error {},
  putToStorage: put,
}));
vi.mock("@/components/academy/lesson-media", () => ({
  LessonMediaItem: ({ item, enrollmentId }: { item: LessonMedia; enrollmentId: string | null }) => (
    <div data-testid="preview">{`${item.title} / ${enrollmentId}`}</div>
  ),
}));

import { LessonMediaEditor, largeFileRefusal } from "./lesson-media-editor";

const LOCAL: LessonMediaLimits = {
  direct_uploads: false,
  max_bytes: { image: 10 * 1024 ** 2, pdf: 100 * 1024 ** 2, video: 2048 * 1024 ** 2, scorm: 500 * 1024 ** 2 },
};
const BUCKET: LessonMediaLimits = { ...LOCAL, direct_uploads: true };

const item = (over: Partial<LessonMedia> = {}): LessonMedia => ({
  id: "m1", lesson_id: "l1", ordinal: 0, kind: "video", title: "Icing", must_finish: true, source: "link",
  filename: null, size_bytes: null, link_url: "https://youtu.be/x", link_provider: "youtube", link_ref: "x", document_id: null,
  ...over,
});
const lesson = (media: LessonMedia[] = []): Lesson => ({
  id: "l1", course_id: "c1", ordinal: 0, title: "Winter", body_markdown: "", media, quiz_id: null, created_at: "", updated_at: "",
});

function file(name: string, size = 1000, type = "application/octet-stream") {
  const made = new File(["x"], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
}

function show(media: LessonMedia[] = [], limits: LessonMediaLimits | null = LOCAL) {
  return render(
    <LessonMediaEditor
      courseId="c1"
      lesson={lesson(media)}
      limits={limits}
      library={[
        { document_id: "d1", title: "GOM", category: "Manuals", kind: "pdf" },
        { document_id: "d2", title: "Ramp chart", category: "Ramp", kind: "image" },
      ]}
    />,
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
const add = () => fireEvent.click(screen.getByRole("button", { name: "Add to lesson" }));
const pick = (chosen: File) =>
  fireEvent.change(screen.getByLabelText("File"), { target: { files: [chosen] } });

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  put.mockReset();
  refresh.mockReset();
  for (const action of [
    actions.addMediaFileAction,
    actions.addMediaLinkAction,
    actions.addMediaDocumentAction,
    actions.completeMediaUploadAction,
    actions.updateMediaAction,
    actions.removeMediaAction,
  ]) {
    action.mockResolvedValue({ error: null });
  }
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("adding a file", () => {
  it("a small one goes through the app", async () => {
    show();
    open();
    pick(file("wing.pdf"));
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Handout" } });
    add();
    await waitFor(() => expect(actions.addMediaFileAction).toHaveBeenCalled());
    const form = actions.addMediaFileAction.mock.calls[0][0] as FormData;
    expect(form.get("lesson_id")).toBe("l1");
    expect(form.get("title")).toBe("Handout");
    expect(form.get("must_finish")).toBe("on");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("form", { name: "Add to this lesson" })).toBeNull();
  });

  it("reference only, when unticked", async () => {
    show();
    open();
    pick(file("gom.pdf"));
    fireEvent.click(screen.getByRole("checkbox", { name: /has to watch it or page it/ }));
    add();
    await waitFor(() => expect(actions.addMediaFileAction).toHaveBeenCalled());
    expect((actions.addMediaFileAction.mock.calls[0][0] as FormData).get("must_finish")).toBeNull();
  });

  it("a picture isn't asked whether it must be finished", () => {
    show();
    open();
    pick(file("wing.png"));
    expect(screen.queryByRole("checkbox", { name: /has to watch it or page it/ })).toBeNull();
  });

  it("PowerPoint is stopped with what to do instead", async () => {
    show();
    open();
    pick(file("winter.pptx"));
    add();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Save As, PDF/);
    expect(actions.addMediaFileAction).not.toHaveBeenCalled();
  });

  it("a large file on a server with no bucket is refused, with a way round", async () => {
    show([], LOCAL);
    open();
    pick(file("long.mp4", 50_000_000));
    add();
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be uploaded on this server.*YouTube or Vimeo/);
    expect(actions.startMediaUploadAction).not.toHaveBeenCalled();
  });

  it("a large file with a bucket goes straight there", async () => {
    actions.startMediaUploadAction.mockResolvedValue({
      ticket: { file_key: "t/l/k.mp4", url: "https://bucket/put", headers: { "Content-Type": "video/mp4" }, expires_in: 900 },
      error: null,
    });
    put.mockResolvedValue(undefined);
    show([], BUCKET);
    open();
    pick(file("long.mp4", 500_000_000));
    add();
    await waitFor(() => expect(actions.completeMediaUploadAction).toHaveBeenCalled());
    expect(actions.startMediaUploadAction).toHaveBeenCalledWith("l1", { filename: "long.mp4", size: 500_000_000 });
    expect(put.mock.calls[0][0]).toBe("https://bucket/put");
    expect(actions.completeMediaUploadAction).toHaveBeenCalledWith("c1", "l1", {
      fileKey: "t/l/k.mp4", filename: "long.mp4", title: "", mustFinish: true,
    });
    expect(actions.addMediaFileAction).not.toHaveBeenCalled();
  });

  it("a refusal from the service stays on the form", async () => {
    actions.addMediaFileAction.mockResolvedValue({ error: "A lesson can show pictures…" });
    show();
    open();
    pick(file("x.pdf"));
    add();
    expect(await screen.findByRole("alert")).toHaveTextContent("A lesson can show pictures");
    expect(screen.getByRole("form", { name: "Add to this lesson" })).toBeInTheDocument();
  });

  it("no file, no send", async () => {
    show();
    open();
    add();
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a file.");
  });
});

describe("adding a link or a library document", () => {
  it("a video link", async () => {
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Video link" }));
    fireEvent.change(screen.getByLabelText("Video link"), { target: { value: " https://youtu.be/abc123DEF45 " } });
    add();
    await waitFor(() =>
      expect(actions.addMediaLinkAction).toHaveBeenCalledWith("c1", "l1", {
        url: "https://youtu.be/abc123DEF45", title: "", mustFinish: true,
      }),
    );
  });

  it("from the library", async () => {
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "From the library" }));
    fireEvent.change(screen.getByLabelText("Document"), { target: { value: "d1" } });
    add();
    await waitFor(() =>
      expect(actions.addMediaDocumentAction).toHaveBeenCalledWith("c1", "l1", {
        documentId: "d1", title: "", mustFinish: true,
      }),
    );
  });

  it("a library picture isn't asked whether it must be finished", () => {
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "From the library" }));
    fireEvent.change(screen.getByLabelText("Document"), { target: { value: "d2" } });
    expect(screen.queryByRole("checkbox", { name: /has to watch it or page it/ })).toBeNull();
  });
});

describe("the list", () => {
  it("says when there's nothing", () => {
    show();
    expect(screen.getByText(/this lesson is text only/)).toBeInTheDocument();
  });

  it("moves, with the ends closed off", async () => {
    show([item(), item({ id: "m2", title: "Handout", kind: "pdf" })]);
    expect(screen.getByRole("button", { name: "Move Icing up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Handout down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move Icing down" }));
    await waitFor(() => expect(actions.updateMediaAction).toHaveBeenCalledWith("c1", "m1", { move: "down" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("changes whether it must be finished", async () => {
    show([item()]);
    fireEvent.click(screen.getByRole("checkbox", { name: /has to watch it or page it/ }));
    await waitFor(() => expect(actions.updateMediaAction).toHaveBeenCalledWith("c1", "m1", { must_finish: false }));
  });

  it("a picture has no such box", () => {
    show([item({ kind: "image" })]);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("removes, after asking", async () => {
    show([item()]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Icing" }));
    await waitFor(() => expect(actions.removeMediaAction).toHaveBeenCalledWith("c1", "m1"));
  });

  it("doesn't remove when the author says no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    show([item()]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Icing" }));
    await act(async () => {});
    expect(actions.removeMediaAction).not.toHaveBeenCalled();
  });

  it("previews as a learner sees it, recording nothing", () => {
    show([item()]);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTestId("preview")).toHaveTextContent("Icing / null");
  });
});

describe("largeFileRefusal", () => {
  it("only for a file over the limit with no bucket", () => {
    expect(largeFileRefusal(file("a.mp4", 1000), LOCAL)).toBeNull();
    expect(largeFileRefusal(file("a.mp4", 5_000_000), BUCKET)).toBeNull();
    expect(largeFileRefusal(file("a.mp4", 5_000_000), LOCAL)).toMatch(/too large/);
    expect(largeFileRefusal(file("a.mp4", 5_000_000), null)).toMatch(/too large/);
  });
});
