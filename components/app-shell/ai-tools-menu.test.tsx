import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AI_TOOLS, visibleAiTools } from "./modules";
import { AiToolsMenu } from "./ai-tools-menu";

/**
 * The top-bar AI menu.
 *
 * Legacy exposes the AI tools from a dropdown on every page rather
 * than from a department nav. That placement is what makes Safety
 * Intelligence reachable by a safety officer — a role the service
 * names first and which is not admitted to the Admin department,
 * where /ai/* resolves.
 */

describe("who sees which tool", () => {
  it("gives a safety officer Safety Intelligence", () => {
    // The gap this menu exists to close. The service says "a safety
    // officer is the point of this tool, so they lead", and the
    // department nav could never show it to them.
    const ids = visibleAiTools(["safety_officer"]).map((t) => t.id);
    expect(ids).toContain("safety-intelligence");
  });

  it("does not give a safety officer Delay Alerts", () => {
    // Not in the delay service's gate. A menu entry that leads to a
    // refusal reads as broken rather than as not theirs.
    const ids = visibleAiTools(["safety_officer"]).map((t) => t.id);
    expect(ids).not.toContain("delay-alerts");
  });

  it("gives a dispatcher Delay Alerts but not Safety Intelligence", () => {
    const ids = visibleAiTools(["dispatcher"]).map((t) => t.id);
    expect(ids).toContain("delay-alerts");
    expect(ids).not.toContain("safety-intelligence");
  });

  it("gives a pilot only the ungated tools", () => {
    const ids = visibleAiTools(["pilot"]).map((t) => t.id);
    expect(ids).toEqual(["fleetbrain", "ops-brief"]);
  });

  it("gives an exec admin everything", () => {
    expect(visibleAiTools(["exec_admin"])).toHaveLength(AI_TOOLS.length);
  });

  it("fails open when roles could not be loaded", () => {
    // Same rule as the department and module checks: a cluttered menu
    // beats an empty one, and the services still refuse anything the
    // user may click.
    expect(visibleAiTools([])).toHaveLength(AI_TOOLS.length);
  });

  it("mirrors each service's gate rather than inventing one", () => {
    const byId = Object.fromEntries(AI_TOOLS.map((t) => [t.id, t.roles]));
    expect(new Set(byId["safety-intelligence"])).toEqual(
      new Set([
        "exec_admin",
        "director_of_operations",
        "chief_pilot",
        "safety_officer",
      ]),
    );
    expect(new Set(byId["delay-alerts"])).toEqual(
      new Set([
        "exec_admin",
        "director_of_operations",
        "chief_pilot",
        "dispatcher",
      ]),
    );
  });
});

describe("the menu", () => {
  const tools = visibleAiTools(["exec_admin"]);

  it("is closed until asked", () => {
    render(<AiToolsMenu tools={tools} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens on click and lists every tool", () => {
    render(<AiToolsMenu tools={tools} />);
    fireEvent.click(screen.getByLabelText("AI Assistant"));
    const menu = screen.getByRole("menu", { name: "AI tools" });
    expect(menu).toBeInTheDocument();
    for (const t of tools) {
      expect(screen.getByRole("menuitem", { name: t.label })).toHaveAttribute(
        "href",
        t.href,
      );
    }
  });

  it("closes on Escape", () => {
    // The button is keyboard-reachable, so the menu has to be
    // dismissible the same way.
    render(<AiToolsMenu tools={tools} />);
    fireEvent.click(screen.getByLabelText("AI Assistant"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders a plain link when there is only one tool", () => {
    // A dropdown that opens to a single item is a click nobody needed.
    render(<AiToolsMenu tools={[tools[0]]} />);
    expect(screen.getByLabelText("AI Assistant")).toHaveAttribute(
      "href",
      tools[0].href,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when no tool is available", () => {
    const { container } = render(<AiToolsMenu tools={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
