import type {
  LessonMedia,
  LessonMediaKind,
} from "@/lib/api/academy";

export const MEDIA_KIND_LABELS: Record<LessonMediaKind, string> = {
  image: "Picture",
  video: "Video",
  pdf: "PDF",
};

/** Where the browser gets an item's file. A YouTube or Vimeo link has none:
 *  those play in the provider's own player. */
export function mediaFileUrl(item: LessonMedia): string {
  if (item.source === "document") return `/api/documents/${item.document_id}/download`;
  if (item.source === "link") return item.link_url ?? "";
  return `/api/academy/media/${item.id}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Where an item comes from, for the author. */
export function mediaSourceText(item: LessonMedia): string {
  if (item.source === "document") return "From the document library";
  if (item.source === "link") {
    if (item.link_provider === "youtube") return "YouTube";
    if (item.link_provider === "vimeo") return "Vimeo";
    return "Video file on the web";
  }
  const size = item.size_bytes ? ` (${formatBytes(item.size_bytes)})` : "";
  return `${item.filename ?? "Uploaded"}${size}`;
}

/** "Video · PDF": what's in a lesson, on the course's outline. */
export function mediaSummary(items: LessonMedia[]): string {
  const kinds: LessonMediaKind[] = ["video", "pdf", "image"];
  return kinds
    .filter((kind) => items.some((item) => item.kind === kind))
    .map((kind) => MEDIA_KIND_LABELS[kind])
    .join(" · ");
}

function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/** What's left before a lesson can complete, or its quiz open. */
export function remainingText(items: LessonMedia[]): string {
  const videos = items.filter((item) => item.kind === "video").length;
  const pdfs = items.filter((item) => item.kind === "pdf").length;
  const parts = [
    videos ? `watch ${counted(videos, "the video", "videos")}` : null,
    pdfs ? `page through ${counted(pdfs, "the PDF", "PDFs")}` : null,
  ].filter(Boolean);
  const said = parts.join(" and ");
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} to the end to continue.`;
}

/** "lessons 1 and 3" for the earlier lessons a quiz is waiting on. */
export function lessonNumbersText(numbers: number[]): string {
  if (numbers.length === 1) return `lesson ${numbers[0]}`;
  const last = numbers[numbers.length - 1];
  return `lessons ${numbers.slice(0, -1).join(", ")} and ${last}`;
}

const REFUSALS: Record<string, string> = {
  save_slides_as_pdf:
    "PowerPoint files can't be shown directly. In PowerPoint choose File, Save As, PDF, then upload the PDF. It looks exactly as you made it.",
  save_heic_as_jpeg: "This is a HEIC photo. Save it as a JPEG and upload that.",
  unsupported_file_type:
    "A lesson can show pictures (JPEG, PNG, GIF, WebP), PDFs and videos (MP4, MOV, WebM).",
  file_too_large:
    "That file is too large: pictures up to 10 MB, PDFs up to 100 MB, videos up to 2 GB.",
  file_is_empty: "That file is empty.",
  unsupported_video_link:
    "Use a YouTube or Vimeo link, or a direct https link to a video file (.mp4, .mov, .webm).",
  document_not_found: "That document is no longer in the library.",
  document_type_not_supported:
    "That document's current version isn't a PDF, picture or video.",
  direct_upload_unavailable: "Large files can't be uploaded on this server.",
  upload_not_found: "The file didn't arrive in storage. Try again.",
  upload_already_added: "That file has already been added.",
  lesson_not_found: "Lesson not found: it may have been deleted in another tab.",
  media_not_found: "That item is gone: it may have been removed in another tab.",
};

/** A refusal from the service, in words. `raw` is its response body. */
export function mediaRefusalWords(raw: string): string | null {
  try {
    const detail = JSON.parse(raw)?.detail;
    return typeof detail === "string" ? (REFUSALS[detail] ?? null) : null;
  } catch {
    return null;
  }
}

/** Why a chosen file can't be sent, judged in the browser, or null. */
export function fileRefusalBeforeSending(name: string): string | null {
  return /\.(pptx?|ppsx?|key|odp)$/i.test(name) ? REFUSALS.save_slides_as_pdf : null;
}
