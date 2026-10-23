import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The few kinds of formatting help text uses (#114): paragraphs,
 * numbered and bulleted lists, **bold** and links to pages.
 *
 * For the guides and FAQ on /help, and for the help assistant's
 * answers, which are told to keep to these. Anything else the model
 * writes comes out as plain text: a heading line as a bold paragraph,
 * code without its backticks.
 *
 * ONLY LINKS INTO THE APP
 *
 * A link renders only when its target is a path here ("/dispatch",
 * "/help#faq-..."). Any other target, including "//host" and
 * "javascript:", renders as its label alone: an answer can't send
 * someone off the site. Nothing is ever set as HTML; React escapes
 * the text.
 */

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function isAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const plain = text.replace(/`([^`]+)`/g, "$1");
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of plain.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push(plain.slice(last, at));
    const [, bold, label, href] = match;
    if (bold !== undefined) {
      out.push(
        <strong key={at} className="font-semibold text-foreground">
          {bold}
        </strong>,
      );
    } else if (isAppPath(href)) {
      out.push(
        <Link key={at} href={href} onClick={onNavigate} className="text-primary hover:underline">
          {label}
        </Link>,
      );
    } else {
      out.push(label);
    }
    last = at + match[0].length;
  }
  if (last < plain.length) out.push(plain.slice(last));
  return out;
}

type Block = { kind: "p" | "ol" | "ul"; lines: string[]; start?: number };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  // On an object, so the type checker doesn't narrow it to the null it
  // starts as: `close` empties it between lines.
  const open: { block: Block | null } = { block: null };
  const close = () => {
    if (open.block) out.push(open.block);
    open.block = null;
  };
  const into = (kind: Block["kind"]): Block => {
    if (open.block?.kind !== kind) {
      close();
      open.block = { kind, lines: [] };
    }
    return open.block;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (!line) {
      close();
    } else if (numbered) {
      const list = into("ol");
      // A list the answer interrupted (a step with points under it)
      // goes on from its own number rather than starting again at 1.
      list.start ??= Number(numbered[0].split(/[.)]/)[0]);
      list.lines.push(numbered[1]);
    } else if (bullet) {
      into("ul").lines.push(bullet[1]);
    } else if (heading) {
      close();
      out.push({ kind: "p", lines: [`**${heading[1].replace(/\*/g, "")}**`] });
    } else {
      into("p").lines.push(line);
    }
  }
  close();
  return out;
}

export function RichText({
  text,
  onNavigate,
  className,
}: {
  text: string;
  /** Called when a link is followed: the help panel closes itself. */
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 leading-relaxed", className)}>
      {blocks(text).map((block, i) => {
        if (block.kind === "p") {
          return <p key={i}>{inline(block.lines.join(" "), onNavigate)}</p>;
        }
        const List = block.kind === "ol" ? "ol" : "ul";
        return (
          <List
            key={i}
            start={block.kind === "ol" && block.start !== 1 ? block.start : undefined}
            className={cn("space-y-1 pl-5", block.kind === "ol" ? "list-decimal" : "list-disc")}
          >
            {block.lines.map((line, j) => (
              <li key={j}>{inline(line, onNavigate)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
