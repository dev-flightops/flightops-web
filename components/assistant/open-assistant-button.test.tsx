import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dispatch" }));

import { AssistantProvider } from "./assistant-context";
import { AssistantWidget } from "./assistant-widget";
import { OpenAssistantButton } from "./open-assistant-button";

/** The dispatch packet's AI Assistant opens Peregrine Assistant (#114). */
describe("OpenAssistantButton", () => {
  it("opens the assistant", () => {
    render(
      <AssistantProvider name="Dana" roles={["dispatcher"]}>
        <OpenAssistantButton className="on" disabledClassName="off">AI Assistant</OpenAssistantButton>
        <AssistantWidget />
      </AssistantProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    expect(screen.getByRole("dialog", { name: "Peregrine Assistant" })).toBeInTheDocument();
  });

  it("stays the placeholder where there is no assistant", () => {
    render(<OpenAssistantButton className="on" disabledClassName="off">AI Assistant</OpenAssistantButton>);
    expect(screen.getByRole("button", { name: "AI Assistant" })).toBeDisabled();
  });
});
