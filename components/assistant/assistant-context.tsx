"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { useHelpChat, type HelpChat } from "@/components/help/use-help-chat";

/**
 * Peregrine Assistant's state (#114): the conversation, and whether its
 * window is open.
 *
 * Provided by the staff layout, around the whole app shell, so the
 * floating launcher and the ? panel's "Ask Peregrine Assistant" open the
 * same window, and one conversation carries on across every page.
 */

export interface Assistant {
  chat: HelpChat;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** First name, for the greeting. */
  name: string | null;
  roles: readonly string[];
}

const AssistantContext = createContext<Assistant | null>(null);

export function AssistantProvider({
  name,
  roles,
  children,
}: {
  name: string | null;
  roles: readonly string[];
  children: ReactNode;
}) {
  const chat = useHelpChat();
  const [open, setOpen] = useState(false);
  return (
    <AssistantContext.Provider value={{ chat, open, setOpen, name, roles }}>
      {children}
    </AssistantContext.Provider>
  );
}

/** The assistant, or null outside the staff layout (the portal, tests). */
export function useAssistant(): Assistant | null {
  return useContext(AssistantContext);
}
