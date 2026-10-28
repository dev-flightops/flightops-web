"use client";

import Link from "next/link";

import { useAssistant } from "@/components/assistant/assistant-context";
import { Notice } from "@/components/ff/notice";
import { useOnScreen } from "@/lib/help/on-screen";
import { canSetUp, SETUP_PLACES, type SetupPlace } from "@/lib/setup/places";

/**
 * A setting the page needs and doesn't have (#138), said where the work
 * stops: what isn't set, what that stops, what to do meanwhile, and where
 * it's set. A link there for someone who may set it; who to ask for anyone
 * else.
 *
 * Greg, 28 Oct, after Open Flight stalled on an aircraft with no cruise
 * speed: "we have to alarm to the user why it's failed". A line of grey
 * text under the times had said so; nobody reads it while the button does
 * nothing. The same words go to Peregrine Assistant with a question asked
 * from the page (lib/help/on-screen.ts).
 */
export function SetupNotice({
  place,
  missing,
  plural = false,
  stops,
  sentence,
  meanwhile,
  fix = "set it",
  canFix,
  className,
}: {
  place: SetupPlace;
  /** What isn't set, starting the sentence: "N200PA's cruise speed". */
  missing?: string;
  /** `missing` names more than one thing: "aren't set". */
  plural?: boolean;
  /** What that stops, after "so": "the leg times can't fill in". */
  stops?: string;
  /** The whole first sentence, when "… isn't set, so …" doesn't fit:
   *  "No aircraft is active, so a flight can't be opened." */
  sentence?: string;
  /** What to do until it's set: "Type each leg's times." */
  meanwhile?: string;
  /** What to do there, after "Ask … to": "make one active". */
  fix?: string;
  /** The viewer's roles may set it at `place`. Left out, it's worked out
   *  from the signed-in roles the layout holds (assistant-context). */
  canFix?: boolean;
  className?: string;
}) {
  const where = SETUP_PLACES[place];
  const roles = useAssistant()?.roles ?? [];
  const linked = canFix ?? canSetUp(roles, place);
  const said = sentence ?? `${missing} ${plural ? "aren’t" : "isn’t"} set, so ${stops}.`;
  useOnScreen(
    `Setup needed: ${said}${meanwhile ? ` ${meanwhile}` : ""} It’s done under ${where.name}, by ${where.who}.`,
  );
  return (
    <Notice tone="yellow" label="Setup needed" className={className}>
      {said}
      {meanwhile ? ` ${meanwhile}` : null}{" "}
      {linked ? (
        <Link href={where.href} className="font-semibold text-primary hover:underline">
          {`${fix.charAt(0).toUpperCase()}${fix.slice(1)} under ${where.name} ›`}
        </Link>
      ) : (
        `Ask ${where.who} to ${fix} under ${where.name}.`
      )}
    </Notice>
  );
}

/**
 * Something the page needed and couldn't load (#138), said instead of
 * showing it as empty.
 *
 * The client's customer dropdown listed no one for three months: every
 * call for the list failed and the page showed the failure as an empty
 * list (#137). A list that didn't load says so, so nobody acts on
 * "there's none".
 */
export function LoadFailedNotice({
  what,
  meaning,
  className,
}: {
  /** What didn't load: ["the crew list", "the type qualifications"]. */
  what: string[];
  /** What that means here: "The pilots below may be incomplete." */
  meaning?: string;
  className?: string;
}) {
  const list = listed(what);
  const said = `Couldn’t load ${list}.${meaning ? ` ${meaning}` : ""}`;
  useOnScreen(what.length ? `${said} Reloading the page tries again.` : null);
  if (!what.length) return null;
  return (
    <Notice tone="red" label="Incomplete" className={className}>
      {said} Reload the page to try again; if it keeps happening, tell your company administrator.
    </Notice>
  );
}

function listed(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * A notice in the page's own words that Peregrine Assistant should see
 * too (#138): a reason worked out elsewhere, as the fuel estimate's list
 * of what it lacks, which already says where each one is set.
 */
export function OnScreenNotice({
  tone,
  label,
  text,
  className,
}: {
  tone: "red" | "yellow";
  label: string;
  text: string;
  className?: string;
}) {
  useOnScreen(`${label}: ${text}`);
  return (
    <Notice tone={tone} label={label} className={className}>
      {text}
    </Notice>
  );
}

/** The same inside a line of text, where a notice block would break the
 *  layout: a risk-matrix row's note (#138). `said` is what the assistant
 *  gets, when the short text on screen needs its context. */
export function OnScreenText({ text, said, className }: { text: string; said?: string; className?: string }) {
  useOnScreen(said ?? text);
  return <span className={className}>{text}</span>;
}
