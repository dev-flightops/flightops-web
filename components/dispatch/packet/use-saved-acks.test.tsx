import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const refresh = vi.fn();
const save = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(app)/dispatch/ack-actions", () => ({
  saveAcknowledgmentsAction: (...args: unknown[]) => save(...args),
}));

import { TICK_SETTLE_MS, useSavedAcks } from "./use-saved-acks";

beforeEach(() => { vi.useFakeTimers(); save.mockReset(); refresh.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

it("saves a later untick after a slow tick, so the server keeps the final choice", async () => {
  let finishFirst!: () => void;
  let serverTicked = false;
  save.mockImplementationOnce(() => new Promise((resolve) => {
    finishFirst = () => { serverTicked = true; resolve({ ok: true }); };
  }));
  save.mockImplementationOnce(async () => { serverTicked = false; return { ok: true }; });
  const { result } = renderHook(() => useSavedAcks("f1", "notam", new Set()));
  act(() => result.current.change(["PABE"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  act(() => result.current.change(["PABE"], false));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  expect(result.current.isOn("PABE")).toBe(false);
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => finishFirst());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][1]).toEqual([expect.objectContaining({ key: "PABE", on: false })]);
  expect(serverTicked).toBe(false);
});

it("does not move queued ticks or optimistic state to another flight", async () => {
  save.mockResolvedValue({ ok: true });
  const { result, rerender } = renderHook(
    ({ flightId }) => useSavedAcks(flightId, "notam", new Set()),
    { initialProps: { flightId: "f1" } },
  );
  act(() => result.current.change(["PABE"], true));
  rerender({ flightId: "f2" });
  expect(result.current.isOn("PABE")).toBe(false);
  act(() => result.current.change(["PANC"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  expect(save).toHaveBeenCalledWith("f2", [expect.objectContaining({ key: "PANC", on: true })]);
  expect(save.mock.calls.every(([id, changes]) => id !== "f2" || changes.every((c: {key: string}) => c.key !== "PABE"))).toBe(true);
});

it("an older failure does not erase a newer queued tick", async () => {
  let refuse!: () => void;
  let finishRetry!: () => void;
  save.mockImplementationOnce(() => new Promise((resolve) => {
    refuse = () => resolve({ ok: false, error: "Temporary failure" });
  }));
  save.mockImplementationOnce(() => new Promise((resolve) => {
    finishRetry = () => resolve({ ok: true });
  }));
  const { result } = renderHook(() => useSavedAcks("f1", "notam", new Set()));
  act(() => result.current.change(["PABE"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  act(() => result.current.change(["PABE"], false));
  act(() => result.current.change(["PABE"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  await act(async () => refuse());
  expect(result.current.isOn("PABE")).toBe(true);
  expect(result.current.pending).toBe(true);
  await act(async () => finishRetry());
  expect(result.current.error).toBeNull();
  expect(result.current.pending).toBe(false);
});

it("keeps the pending untick when an older refresh arrives", async () => {
  let finish!: () => void;
  save.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ ok: true }); }));
  const { result, rerender } = renderHook(
    ({ saved }) => useSavedAcks("f1", "notam", saved),
    { initialProps: { saved: new Set(["PABE"]) } },
  );
  act(() => result.current.change(["PABE"], false));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  rerender({ saved: new Set() });
  rerender({ saved: new Set(["PABE"]) });
  expect(result.current.isOn("PABE")).toBe(false);
  await act(async () => finish());
});

it("an old flight's failed response cannot alter the new packet", async () => {
  let refuseOld!: () => void;
  save.mockImplementationOnce(() => new Promise((resolve) => {
    refuseOld = () => resolve({ ok: false, error: "Old flight save failed" });
  }));
  save.mockResolvedValue({ ok: true });
  const { result, rerender } = renderHook(
    ({ flightId }) => useSavedAcks(flightId, "notam", new Set()),
    { initialProps: { flightId: "f1" } },
  );
  act(() => result.current.change(["PANC"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  rerender({ flightId: "f2" });
  act(() => result.current.change(["PANC"], true));
  await act(() => vi.advanceTimersByTimeAsync(TICK_SETTLE_MS));
  await act(async () => refuseOld());
  expect(result.current.isOn("PANC")).toBe(true);
  expect(result.current.error).toBeNull();
  expect(result.current.pending).toBe(false);
});
