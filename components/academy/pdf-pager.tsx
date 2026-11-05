"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

import { type MediaTracking, postMediaProgress } from "./media-progress";

export const PDF_PROBLEM =
  "This PDF can't be opened here. If it keeps happening, tell your training manager: they can replace it.";

const RETRY_MS = 5_000;

interface PdfDocument {
  numPages: number;
  getPage(number: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }): {
    promise: Promise<void>;
    cancel(): void;
  };
}

async function openPdf(src: string): Promise<PdfDocument> {
  // Loaded only when a lesson has a PDF: the library is large. The legacy
  // build, as a pilot's tablet may not be on the newest browser.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const response = await fetch(src);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  return (await pdfjs.getDocument({ data, isEvalSupported: false }).promise) as unknown as PdfDocument;
}

/**
 * A PDF or a deck of slides saved as one, a page at a time, in the lesson.
 * Going forward is one page at a time, so a PDF that has to be read is seen to
 * its last page; the service counts it the same way.
 */
export function PdfPager({
  src,
  title,
  tracking,
  initialPage = 0,
  onFinished,
}: {
  src: string;
  title: string;
  tracking: MediaTracking | null;
  /** The furthest page reached so far; 0 when not started. */
  initialPage?: number;
  onFinished?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document_, setDocument] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(Math.max(initialPage, 1));
  const [drawing, setDrawing] = useState(true);
  const [problem, setProblem] = useState(false);

  const counted = useRef(initialPage);
  const furthest = useRef(Math.max(initialPage, 1));
  const announced = useRef(false);
  const sending = useRef(false);
  const done = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs, so finishing the PDF doesn't open it again.
  const trackingNow = useRef(tracking);
  trackingNow.current = tracking;
  const finishedCallback = useRef(onFinished);
  finishedCallback.current = onFinished;

  /** Tell the service the page count, then each page it hasn't counted yet,
   *  in turn: it counts one page further at most per report. */
  const flush = useCallback(async (pageCount: number) => {
    const target = trackingNow.current;
    if (!target || sending.current || done.current) return;
    sending.current = true;
    while (!done.current && (!announced.current || counted.current < furthest.current)) {
      const next = announced.current ? counted.current + 1 : Math.max(counted.current, 1);
      const row = await postMediaProgress(target, { page: next, page_count: pageCount });
      if (!row) {
        retry.current = setTimeout(() => void flush(pageCount), RETRY_MS);
        break;
      }
      const moved = row.page > counted.current;
      counted.current = Math.max(counted.current, row.page);
      if (row.finished) {
        done.current = true;
        finishedCallback.current?.();
      }
      if (announced.current && !moved) break;
      announced.current = true;
    }
    sending.current = false;
  }, []);

  useEffect(() => {
    let gone = false;
    let opened: PdfDocument | null = null;
    openPdf(src)
      .then((pdf) => {
        if (gone) {
          void pdf.destroy();
          return;
        }
        opened = pdf;
        setDocument(pdf);
        setPage((current) => Math.min(current, pdf.numPages));
        void flush(pdf.numPages);
      })
      .catch(() => {
        if (!gone) setProblem(true);
      });
    return () => {
      gone = true;
      if (retry.current) clearTimeout(retry.current);
      void opened?.destroy();
    };
  }, [src, flush]);

  useEffect(() => {
    if (!document_ || !canvas.current) return;
    const target = canvas.current;
    let gone = false;
    let task: { cancel(): void } | null = null;
    setDrawing(true);
    (async () => {
      const pdfPage = await document_.getPage(page);
      if (gone) return;
      const width = target.parentElement?.clientWidth || 640;
      const scale = (width / pdfPage.getViewport({ scale: 1 }).width) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale });
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      const render = pdfPage.render({ canvas: target, viewport });
      task = render;
      await render.promise;
      if (!gone) setDrawing(false);
    })().catch((error: { name?: string }) => {
      if (!gone && error?.name !== "RenderingCancelledException") setProblem(true);
    });
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [document_, page]);

  const go = (to: number) => {
    if (!document_ || to < 1 || to > document_.numPages || drawing) return;
    setPage(to);
    if (to > furthest.current) {
      furthest.current = to;
      void flush(document_.numPages);
    }
  };

  if (problem) {
    return (
      <p role="alert" className="notice notice-red">
        {PDF_PROBLEM}
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label={title}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(page + 1);
        if (event.key === "ArrowLeft") go(page - 1);
      }}
    >
      <div className="border border-border bg-white">
        <canvas ref={canvas} className="block h-auto w-full" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={cn(buttonOutline, "disabled:opacity-50")}
          disabled={!document_ || drawing || page <= 1}
          onClick={() => go(page - 1)}
        >
          ‹ Previous
        </button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {document_ ? `Page ${page} of ${document_.numPages}` : "Opening…"}
        </span>
        <button
          type="button"
          className={cn(buttonOutline, "disabled:opacity-50")}
          disabled={!document_ || drawing || page >= document_.numPages}
          onClick={() => go(page + 1)}
        >
          Next ›
        </button>
      </div>
      <p className="mt-2 text-right">
        <a href={src} className={linkCaps}>
          Download
        </a>
      </p>
    </div>
  );
}
