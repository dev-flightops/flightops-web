import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSummaryAction } = vi.hoisted(() => ({
  updateSummaryAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./summary-actions", () => ({ updateSummaryAction }));

import {
  CurrencyCountersField,
  type CurrencyCounters,
} from "./currency-counters-field";

function emptyCounters(): CurrencyCounters {
  return {
    night_takeoffs: null,
    approach_precision: null,
    approach_non_precision: null,
    holds: null,
    ifr_actual_minutes: null,
    ifr_simulated_minutes: null,
  };
}

beforeEach(() => {
  updateSummaryAction.mockReset();
});

describe("CurrencyCountersField — PIC variant (default)", () => {
  it("PATCHes the base key (no sic_ prefix)", () => {
    updateSummaryAction.mockResolvedValueOnce({ status: "ok" });
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={emptyCounters()}
        readOnly={false}
      />,
    );
    const apchPrec = screen.getByLabelText(/appr precision/i);
    fireEvent.change(apchPrec, { target: { value: "2" } });
    fireEvent.blur(apchPrec);
    expect(updateSummaryAction).toHaveBeenCalledWith("log-1", {
      approach_precision: 2,
    });
  });

  it("renders the default PIC heading + footnote", () => {
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={emptyCounters()}
        readOnly={false}
      />,
    );
    expect(screen.getByText(/pilot entries/i)).toBeInTheDocument();
    expect(
      screen.getByText(/spec 5 ifr currency/i),
    ).toBeInTheDocument();
  });
});

describe("CurrencyCountersField — SIC variant", () => {
  it("PATCHes sic_-prefixed keys", () => {
    updateSummaryAction.mockResolvedValueOnce({ status: "ok" });
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={emptyCounters()}
        readOnly={false}
        variant="sic"
      />,
    );
    const holds = screen.getByLabelText(/^holds$/i);
    fireEvent.change(holds, { target: { value: "1" } });
    fireEvent.blur(holds);
    expect(updateSummaryAction).toHaveBeenCalledWith("log-1", {
      sic_holds: 1,
    });
  });

  it("renders the default SIC heading + footnote", () => {
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={emptyCounters()}
        readOnly={false}
        variant="sic"
      />,
    );
    expect(screen.getByText(/sic entries/i)).toBeInTheDocument();
    expect(
      screen.getByText(/mirrors the pic counters/i),
    ).toBeInTheDocument();
  });

  it("honors a custom title override", () => {
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={emptyCounters()}
        readOnly={false}
        variant="sic"
        title="SIC Entries — Alice"
      />,
    );
    expect(screen.getByText("SIC Entries — Alice")).toBeInTheDocument();
  });

  it("pre-fills inputs from initial values", () => {
    render(
      <CurrencyCountersField
        logId="log-1"
        initial={{
          night_takeoffs: 1,
          approach_precision: 2,
          approach_non_precision: 0,
          holds: 1,
          ifr_actual_minutes: 30,
          ifr_simulated_minutes: 0,
        }}
        readOnly={false}
        variant="sic"
      />,
    );
    const apchPrec = screen.getByLabelText(
      /appr precision/i,
    ) as HTMLInputElement;
    expect(apchPrec.value).toBe("2");
    const ifrActual = screen.getByLabelText(
      /ifr actual/i,
    ) as HTMLInputElement;
    expect(ifrActual.value).toBe("30");
  });
});
