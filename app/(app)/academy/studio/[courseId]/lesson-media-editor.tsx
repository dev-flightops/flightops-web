"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LessonMediaItem } from "@/components/academy/lesson-media";
import {
  buttonOutline,
  buttonSolid,
  linkCaps,
  segment,
  segmentGroup,
} from "@/components/ff/controls";
import {
  MEDIA_KIND_LABELS,
  fileRefusalBeforeSending,
  mediaSourceText,
  scormPassText,
} from "@/lib/academy/media";
import type {
  Lesson,
  LessonMedia,
  LessonMediaLibraryItem,
  LessonMediaLimits,
} from "@/lib/api/academy";
import { DirectUploadError, putToStorage } from "@/lib/direct-upload";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

import {
  addMediaDocumentAction,
  addMediaFileAction,
  addMediaLinkAction,
  completeMediaUploadAction,
  removeMediaAction,
  startMediaUploadAction,
  updateMediaAction,
} from "./actions";

type AddWith = "file" | "link" | "library";

const MUST_FINISH_LABEL = "The learner has to watch it or page it to the end";
const MUST_PASS_LABEL = "The learner has to pass or complete it";
const IMAGE_FILE = /\.(jpe?g|png|gif|webp)$/i;

/** Why a file over the web host's limit can't be uploaded here, or null when
 *  it can go straight to storage. */
export function largeFileRefusal(file: File, limits: LessonMediaLimits | null): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  if (limits?.direct_uploads) return null;
  return `${file.name} is too large: files over ${MAX_UPLOAD_LABEL} can't be uploaded on this server. For a video, add a YouTube or Vimeo link instead.`;
}

/** A lesson's pictures, videos, PDFs and SCORM modules, for the course's
 *  author (#170; SCORM from the bug doc's Section 6). */
export function LessonMediaEditor({
  courseId,
  lesson,
  limits,
  library,
}: {
  courseId: string;
  lesson: Lesson;
  limits: LessonMediaLimits | null;
  library: LessonMediaLibraryItem[];
}) {
  const media = lesson.media ?? [];
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="eyebrow">Pictures, videos, PDFs and SCORM</h4>
        <button type="button" className={linkCaps} onClick={() => setAdding((open) => !open)}>
          {adding ? "Close" : "+ Add"}
        </button>
      </div>
      {media.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {media.map((item, index) => (
            <MediaRow
              key={item.id}
              courseId={courseId}
              item={item}
              first={index === 0}
              last={index === media.length - 1}
            />
          ))}
        </ul>
      ) : !adding ? (
        <p className="mt-1 text-xs text-muted-foreground">None yet: this lesson is text only.</p>
      ) : null}
      {adding ? (
        <AddMediaForm
          courseId={courseId}
          lessonId={lesson.id}
          limits={limits}
          library={library}
          onAdded={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

function MediaRow({
  courseId,
  item,
  first,
  last,
}: {
  courseId: string;
  item: LessonMedia;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error: string | null }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) router.refresh();
    });

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <span className="eyebrow mr-2">{MEDIA_KIND_LABELS[item.kind]}</span>
          <span className="text-sm font-semibold">{item.title}</span>
          <span className="ml-2 break-words text-xs text-muted-foreground">
            {mediaSourceText(item)}
          </span>
          {item.kind === "scorm" ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{scormPassText(item)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={linkCaps} onClick={() => setPreviewing((open) => !open)}>
            {previewing ? "Hide" : "Preview"}
          </button>
          <button
            type="button"
            className={cn(linkCaps, "disabled:opacity-40")}
            aria-label={`Move ${item.title} up`}
            disabled={first || pending}
            onClick={() => run(() => updateMediaAction(courseId, item.id, { move: "up" }))}
          >
            Up
          </button>
          <button
            type="button"
            className={cn(linkCaps, "disabled:opacity-40")}
            aria-label={`Move ${item.title} down`}
            disabled={last || pending}
            onClick={() => run(() => updateMediaAction(courseId, item.id, { move: "down" }))}
          >
            Down
          </button>
          <button
            type="button"
            className={cn(linkCaps, "text-status-red hover:text-status-red disabled:opacity-40")}
            aria-label={`Remove ${item.title}`}
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Take "${item.title}" out of this lesson?`)) {
                run(() => removeMediaAction(courseId, item.id));
              }
            }}
          >
            Remove
          </button>
        </div>
      </div>
      {item.kind !== "image" ? (
        <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            defaultChecked={item.must_finish}
            disabled={pending}
            onChange={(event) => {
              const mustFinish = event.currentTarget.checked;
              run(() => updateMediaAction(courseId, item.id, { must_finish: mustFinish }));
            }}
          />
          {item.kind === "scorm" ? MUST_PASS_LABEL : MUST_FINISH_LABEL}
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 notice notice-red">
          {error}
        </p>
      ) : null}
      {previewing ? (
        <div className="mt-2">
          <LessonMediaItem item={item} enrollmentId={null} finished={false} />
        </div>
      ) : null}
    </li>
  );
}

function AddMediaForm({
  courseId,
  lessonId,
  limits,
  library,
  onAdded,
}: {
  courseId: string;
  lessonId: string;
  limits: LessonMediaLimits | null;
  library: LessonMediaLibraryItem[];
  onAdded: () => void;
}) {
  const router = useRouter();
  const [addWith, setAddWith] = useState<AddWith>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("");
  const [mustFinish, setMustFinish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const picked = library.find((doc) => doc.document_id === documentId);
  const isPicture =
    (addWith === "file" && file !== null && IMAGE_FILE.test(file.name)) ||
    (addWith === "library" && picked?.kind === "image");

  async function sendFile(chosen: File): Promise<string | null> {
    if (chosen.size <= MAX_UPLOAD_BYTES) {
      const form = new FormData();
      form.set("course_id", courseId);
      form.set("lesson_id", lessonId);
      form.set("file", chosen);
      form.set("title", title);
      if (mustFinish) form.set("must_finish", "on");
      return (await addMediaFileAction(form)).error;
    }
    const start = await startMediaUploadAction(lessonId, {
      filename: chosen.name,
      size: chosen.size,
    });
    if (!start.ticket) return start.error ?? "Couldn't start the upload.";
    try {
      await putToStorage(start.ticket.url, start.ticket.headers, chosen, setSent);
    } catch (err) {
      return err instanceof DirectUploadError ? err.message : "The file couldn't be sent to storage.";
    }
    const done = await completeMediaUploadAction(courseId, lessonId, {
      fileKey: start.ticket.file_key,
      filename: chosen.name,
      title,
      mustFinish,
    });
    return done.error;
  }

  const submit = () => {
    setError(null);
    if (addWith === "file") {
      if (!file) return setError("Choose a file.");
      const refusal = fileRefusalBeforeSending(file.name) ?? largeFileRefusal(file, limits);
      if (refusal) return setError(refusal);
    }
    if (addWith === "link" && !url.trim()) return setError("Paste the video's link.");
    if (addWith === "library" && !documentId) return setError("Choose a document.");
    startTransition(async () => {
      const failure =
        addWith === "file"
          ? await sendFile(file as File)
          : addWith === "link"
            ? (await addMediaLinkAction(courseId, lessonId, { url: url.trim(), title, mustFinish })).error
            : (await addMediaDocumentAction(courseId, lessonId, { documentId, title, mustFinish })).error;
      setSent(null);
      setError(failure);
      if (!failure) {
        router.refresh();
        onAdded();
      }
    });
  };

  return (
    <form
      method="post"
      aria-label="Add to this lesson"
      noValidate
      className="mt-2 space-y-3 border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={segmentGroup}>
        {(
          [
            ["file", "Upload a file"],
            ["link", "Video link"],
            ["library", "From the library"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={addWith === value}
            className={segment(addWith === value)}
            onClick={() => {
              setAddWith(value);
              setError(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {addWith === "file" ? (
        <div>
          <label className="field-label" htmlFor={`media-file-${lessonId}`}>
            File
          </label>
          <input
            id={`media-file-${lessonId}`}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/quicktime,video/webm,.m4v,.pptx,.ppt,.zip,application/zip"
            className="ff-input"
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null);
              setError(null);
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Pictures (JPEG, PNG, GIF, WebP), PDFs, videos (MP4 plays everywhere; also MOV and
            WebM), and SCORM 1.2 or 2004 packages as exported (.zip, one SCO). For PowerPoint
            slides, save them as a PDF first.{" "}
            {limits?.direct_uploads
              ? "Pictures up to 10 MB, PDFs up to 100 MB, videos up to 2 GB, SCORM packages up to 500 MB."
              : `Files up to ${MAX_UPLOAD_LABEL} on this server: for a longer video, use a link.`}
          </p>
        </div>
      ) : null}

      {addWith === "link" ? (
        <div>
          <label className="field-label" htmlFor={`media-link-${lessonId}`}>
            Video link
          </label>
          <input
            id={`media-link-${lessonId}`}
            type="url"
            value={url}
            maxLength={2000}
            placeholder="https://www.youtube.com/watch?v=…"
            className="ff-input"
            onChange={(event) => setUrl(event.currentTarget.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            YouTube, Vimeo, or a direct https link to a video file. Its owner has to allow playing
            it on other sites.
          </p>
        </div>
      ) : null}

      {addWith === "library" ? (
        <div>
          <label className="field-label" htmlFor={`media-doc-${lessonId}`}>
            Document
          </label>
          <select
            id={`media-doc-${lessonId}`}
            value={documentId}
            className="ff-input"
            onChange={(event) => setDocumentId(event.currentTarget.value)}
          >
            <option value="">Choose…</option>
            {library.map((doc) => (
              <option key={doc.document_id} value={doc.document_id}>
                {doc.title} ({MEDIA_KIND_LABELS[doc.kind]})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {library.length === 0
              ? "The library has no PDFs, pictures or videos yet."
              : "The lesson always shows the document's current version."}
          </p>
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor={`media-title-${lessonId}`}>
          Title (optional)
        </label>
        <input
          id={`media-title-${lessonId}`}
          value={title}
          maxLength={200}
          className="ff-input"
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </div>

      {!isPicture ? (
        <div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={mustFinish}
              onChange={(event) => setMustFinish(event.currentTarget.checked)}
            />
            {MUST_FINISH_LABEL}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Untick it for something to refer to, like a long manual.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="notice notice-red">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {sent !== null ? (
          <span aria-live="polite" className="text-xs text-muted-foreground">
            Sending… {Math.round(sent * 100)}%
          </span>
        ) : null}
        <button type="button" className={cn(buttonOutline, "disabled:opacity-60")} disabled={pending} onClick={onAdded}>
          Cancel
        </button>
        <button type="submit" className={cn(buttonSolid, "disabled:opacity-60")} disabled={pending}>
          {pending ? "Adding…" : "Add to lesson"}
        </button>
      </div>
    </form>
  );
}
