import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { CurrencyItemRef } from "@/lib/api/types";

vi.mock("./log-completion-action", () => ({ logCompletionAction: vi.fn() }));
// This runner's React has no useActionState; the form's idle state is what's under test.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
}));

import { LogCompletionModal } from "./log-completion-modal";

const item = {
  id: "i-1",
  code: "cfit_training",
  name: "CFIT Training",
  regulation: "AC 120-72",
  interval_type: "annual",
} as unknown as CurrencyItemRef;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 07:00Z on 1 Dec: 1 Dec in New York, still 30 Nov in Alaska.
  vi.setSystemTime(new Date("2026-12-01T07:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("dates the completion by the company's zone, which the action checks (Codex, #513)", () => {
  render(
    <LogCompletionModal pilotId="p-1" pilotName="Pat" item={item} onClose={() => {}} timeZone="America/New_York" />,
  );
  const input = screen.getByLabelText("Completion Date") as HTMLInputElement;
  expect(input.value).toBe("2026-12-01");
  expect(input.max).toBe("2026-12-01");
});

it("is Alaska's day without a zone", () => {
  render(<LogCompletionModal pilotId="p-1" pilotName="Pat" item={item} onClose={() => {}} />);
  expect((screen.getByLabelText("Completion Date") as HTMLInputElement).value).toBe("2026-11-30");
});
