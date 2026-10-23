"use client";

import type { ReactNode } from "react";

import { useAssistant } from "@/components/assistant/assistant-context";

/**
 * A button that opens Peregrine Assistant (#114), for the places that
 * promised one: the dispatch packet's AI Assistant sat disabled as
 * "Coming in M4" next to it. Outside the staff layout, where there is no
 * assistant, it stays the disabled placeholder it was.
 */
export function OpenAssistantButton({
  className,
  disabledClassName,
  children,
}: {
  className: string;
  disabledClassName: string;
  children: ReactNode;
}) {
  const assistant = useAssistant();
  if (!assistant) {
    return (
      <button type="button" disabled title="AI Assistant · Coming in M4" className={disabledClassName}>
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => assistant.setOpen(true)}
      title="Ask Peregrine Assistant how to work this packet"
      className={className}
    >
      {children}
    </button>
  );
}
