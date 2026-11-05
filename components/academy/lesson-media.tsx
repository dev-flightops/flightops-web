"use client";

import { useMemo } from "react";

import { MEDIA_KIND_LABELS, mediaFileUrl } from "@/lib/academy/media";
import type { LessonMedia, LessonMediaProgress } from "@/lib/api/academy";

import { EmbedPlayer } from "./embed-player";
import { PdfPager } from "./pdf-pager";
import { VideoPlayer } from "./video-player";

/**
 * One picture, video or PDF, shown as a learner sees it. With no `enrollmentId`
 * (the studio's preview, or an admin looking at someone else's enrollment)
 * nothing is recorded and nothing is held back.
 */
export function LessonMediaItem({
  item,
  enrollmentId,
  progress,
  finished,
  onFinished,
}: {
  item: LessonMedia;
  enrollmentId: string | null;
  progress?: LessonMediaProgress;
  finished: boolean;
  onFinished?: () => void;
}) {
  const tracking = useMemo(
    () =>
      enrollmentId && item.must_finish && !finished
        ? { enrollmentId, mediaId: item.id }
        : null,
    [enrollmentId, item.id, item.must_finish, finished],
  );

  if (item.kind === "image") {
    return (
      <img src={mediaFileUrl(item)} alt={item.title} loading="lazy" className="block h-auto max-w-full" />
    );
  }
  if (item.kind === "pdf") {
    return (
      <PdfPager
        src={mediaFileUrl(item)}
        title={item.title}
        tracking={tracking}
        initialPage={tracking ? (progress?.page ?? 0) : 0}
        onFinished={onFinished}
      />
    );
  }
  if (item.link_provider === "youtube" || item.link_provider === "vimeo") {
    return (
      <EmbedPlayer
        provider={item.link_provider}
        reference={item.link_ref ?? ""}
        title={item.title}
        tracking={tracking}
        initialPosition={progress?.position_seconds ?? 0}
        onFinished={onFinished}
      />
    );
  }
  return (
    <VideoPlayer
      src={mediaFileUrl(item)}
      title={item.title}
      tracking={tracking}
      initialPosition={progress?.position_seconds ?? 0}
      onFinished={onFinished}
    />
  );
}

/** Where a learner stands on an item, in words. */
export function mediaStatus(item: LessonMedia, finished: boolean): { text: string; done: boolean } {
  if (finished) {
    return { text: item.kind === "video" ? "✓ Watched" : "✓ Read to the end", done: true };
  }
  if (!item.must_finish) {
    return { text: item.kind === "image" ? "" : "For reference", done: false };
  }
  return {
    text: item.kind === "video" ? "Watch to the end" : "Page through to the end",
    done: false,
  };
}

/** A lesson's pictures, videos and PDFs, in order, as a learner goes through them. */
export function LessonMediaList({
  media,
  enrollmentId,
  progress,
  finishedIds,
  onFinished,
}: {
  media: LessonMedia[];
  enrollmentId: string | null;
  progress: LessonMediaProgress[];
  finishedIds: ReadonlySet<string>;
  onFinished?: (mediaId: string) => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      {media.map((item) => {
        const finished = finishedIds.has(item.id);
        const status = mediaStatus(item, finished);
        return (
          <section key={item.id} aria-label={item.title}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                <span className="eyebrow mr-2">{MEDIA_KIND_LABELS[item.kind]}</span>
                {item.title}
              </h3>
              {status.text ? (
                <span
                  className={
                    status.done
                      ? "status-mark text-xs text-status-green"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {status.text}
                </span>
              ) : null}
            </div>
            <LessonMediaItem
              item={item}
              enrollmentId={enrollmentId}
              progress={progress.find((row) => row.media_id === item.id)}
              finished={finished}
              onFinished={() => onFinished?.(item.id)}
            />
          </section>
        );
      })}
    </div>
  );
}
