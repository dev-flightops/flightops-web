"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  SCHEDULE_TAG_LABEL_MAX,
  SCHEDULE_TAG_TONES,
  type ScheduleTag,
  type ScheduleTagTone,
} from "@/lib/api/crew-calendar";
import { cn } from "@/lib/utils";

import { createTagAction, updateTagAction } from "./actions";
import { TAG_SWATCH, TAG_TONE } from "./tag-tones";

type TagOutcome = { ok: true } | { ok: false; error: string };

/** What the dialogs save through: the crew calendar's actions, or the
 *  Mechanic Roster's (#178), whose tags are a palette of their own. */
export interface TagActions {
  create: (label: string, tone: string) => Promise<TagOutcome>;
  update: (tagId: string, patch: { label?: string; tone?: string; is_active?: boolean }) => Promise<TagOutcome>;
  /** Who paints the days, in the new-tag dialog's description. */
  painted: string;
}

// Looked up when called, so a page that never opens a dialog needn't load them.
const CREW_TAG_ACTIONS: TagActions = {
  create: (label, tone) => createTagAction(label, tone),
  update: (tagId, patch) => updateTagAction(tagId, patch),
  painted: "crew days",
};

const LABEL =
  "mb-1 block eyebrow";
const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const SECONDARY =
  "rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60";
const PRIMARY =
  "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60";

function TonePicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: ScheduleTagTone;
  onChange: (tone: ScheduleTagTone) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {SCHEDULE_TAG_TONES.map((tone) => (
        <label key={tone} className="cursor-pointer" title={tone}>
          <input
            type="radio"
            name={name}
            value={tone}
            checked={value === tone}
            onChange={() => onChange(tone)}
            className="peer sr-only"
            aria-label={tone}
          />
          <span
            className={cn(
              "block h-6 w-6 rounded-sm border-2 border-transparent peer-checked:border-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary",
              TAG_SWATCH[tone],
            )}
          />
        </label>
      ))}
    </div>
  );
}

export function NewTagDialog({
  open,
  onClose,
  actions = CREW_TAG_ACTIONS,
}: {
  open: boolean;
  onClose: () => void;
  actions?: TagActions;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        {open && <NewTagForm onClose={onClose} actions={actions} />}
      </DialogContent>
    </Dialog>
  );
}

function NewTagForm({ onClose, actions }: { onClose: () => void; actions: TagActions }) {
  const uid = useId();
  const [label, setLabel] = useState("");
  const [tone, setTone] = useState<ScheduleTagTone>("blue");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const outcome = await actions.create(label, tone);
      if (outcome.ok) onClose();
      else setError(outcome.error);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New Day Tag</DialogTitle>
        <DialogDescription>
          {`A short label your schedulers paint on ${actions.painted}, such as FLY, OFF or TRN.`}
        </DialogDescription>
      </DialogHeader>
      <form method="post" onSubmit={onSubmit} className="space-y-3" noValidate>
        {error && (
          <p
            role="alert"
            className="notice notice-red"
          >
            {error}
          </p>
        )}
        <div>
          <label htmlFor={`${uid}-label`} className={LABEL}>
            Label <span className="text-status-red">*</span>
          </label>
          <input
            id={`${uid}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={SCHEDULE_TAG_LABEL_MAX}
            placeholder="e.g. FLY"
            className={FIELD}
          />
        </div>
        <div>
          <p className={LABEL}>Colour</p>
          <TonePicker name={`${uid}-tone`} value={tone} onChange={setTone} />
        </div>
        <div>
          <p className={LABEL}>Preview</p>
          <span className={cn("rounded border px-2 py-0.5 text-[0.65rem] font-semibold", TAG_TONE[tone])}>
            {label.trim() || "FLY"}
          </span>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending && <Spinner size="xs" />}
            Add Tag
          </button>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * Rename, recolour, archive or restore the company's tags. Archiving keeps
 * every day already painted with a tag; it only leaves the palette.
 */
export function ManageTagsDialog({
  open,
  onClose,
  tags,
  actions = CREW_TAG_ACTIONS,
}: {
  open: boolean;
  onClose: () => void;
  tags: ScheduleTag[];
  actions?: TagActions;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Day Tags</DialogTitle>
          <DialogDescription>
            Archiving a tag takes it off the palette and keeps every day already
            painted with it.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {tags.map((tag) => (
            <TagRow key={`${tag.id}-${tag.label}-${tag.tone}-${tag.is_active}`} tag={tag} actions={actions} />
          ))}
        </ul>
        <DialogFooter className="pt-2">
          <button type="button" onClick={onClose} className={SECONDARY}>
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagRow({ tag, actions }: { tag: ScheduleTag; actions: TagActions }) {
  const uid = useId();
  const [label, setLabel] = useState(tag.label);
  const [tone, setTone] = useState<ScheduleTagTone>(tag.tone);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = label.trim() !== tag.label || tone !== tag.tone;

  function run(patch: { label?: string; tone?: string; is_active?: boolean }) {
    setError(null);
    startTransition(async () => {
      const outcome = await actions.update(tag.id, patch);
      if (!outcome.ok) setError(outcome.error);
    });
  }

  return (
    <li className={cn("py-2", !tag.is_active && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${uid}-label`} className="sr-only">
          Label for {tag.label}
        </label>
        <input
          id={`${uid}-label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={SCHEDULE_TAG_LABEL_MAX}
          disabled={!tag.is_active || pending}
          className={cn(FIELD, "w-28 py-1")}
        />
        <label htmlFor={`${uid}-tone`} className="sr-only">
          Colour for {tag.label}
        </label>
        <select
          id={`${uid}-tone`}
          value={tone}
          onChange={(e) => setTone(e.target.value as ScheduleTagTone)}
          disabled={!tag.is_active || pending}
          className={cn(FIELD, "w-28 py-1")}
        >
          {SCHEDULE_TAG_TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className={cn("rounded border px-2 py-0.5 text-[0.65rem] font-semibold", TAG_TONE[tone])}>
          {label.trim() || tag.label}
        </span>
        <span className="ml-auto flex gap-2">
          {tag.is_active && (
            <button
              type="button"
              onClick={() => run({ label, tone })}
              disabled={!changed || pending}
              className={cn(PRIMARY, "px-2 py-1 text-xs")}
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => run({ is_active: !tag.is_active })}
            disabled={pending}
            className={cn(SECONDARY, "px-2 py-1 text-xs")}
          >
            {tag.is_active ? "Archive" : "Restore"}
          </button>
        </span>
      </div>
      {!tag.is_active && <p className="mt-1 text-[0.65rem] text-muted-foreground">Archived</p>}
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] font-semibold text-status-red">
          {error}
        </p>
      )}
    </li>
  );
}
