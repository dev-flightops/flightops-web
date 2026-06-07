import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RefreshWeatherButton } from "./refresh-weather-button";

describe("RefreshWeatherButton", () => {
  it("renders disabled when no flight is selected", () => {
    render(<RefreshWeatherButton flightSelected={false} />);
    const btn = screen.getByRole("button", { name: /refresh weather/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      "title",
      "Pick a scheduled flight above first",
    );
  });

  it("renders enabled when a flight is selected", () => {
    render(<RefreshWeatherButton flightSelected={true} />);
    const btn = screen.getByRole("button", { name: /refresh weather/i });
    expect(btn).not.toBeDisabled();
  });

  it("calls router.refresh() on click", async () => {
    refresh.mockReset();
    const user = userEvent.setup();
    render(<RefreshWeatherButton flightSelected={true} />);
    await user.click(screen.getByRole("button", { name: /refresh weather/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
