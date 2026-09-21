import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatePickerAffordance } from "./date-picker-affordance";

/**
 * jsdom has no showPicker, and the component swallows the resulting
 * throw on purpose, so a test that did not define one would pass
 * whatever the component did. Defining a spy is what makes these
 * assertions mean anything.
 */
let showPicker: ReturnType<typeof vi.fn>;

beforeEach(() => {
  showPicker = vi.fn();
  (
    HTMLInputElement.prototype as unknown as { showPicker: unknown }
  ).showPicker = showPicker;
});

afterEach(() => {
  delete (HTMLInputElement.prototype as unknown as { showPicker?: unknown })
    .showPicker;
});

function mount(input: HTMLInputElement) {
  document.body.appendChild(input);
  render(<DatePickerAffordance />);
  return input;
}

describe("DatePickerAffordance", () => {
  it("opens the picker when a date field is clicked", () => {
    const el = document.createElement("input");
    el.type = "date";
    mount(el).click();
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("covers datetime-local, which is what the New Flight form uses", () => {
    // ETD and ETA on /flight-following/new are both datetime-local —
    // the exact fields in the 9/17 report.
    const el = document.createElement("input");
    el.type = "datetime-local";
    mount(el).click();
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("leaves other input types alone", () => {
    const el = document.createElement("input");
    el.type = "text";
    mount(el).click();
    expect(showPicker).not.toHaveBeenCalled();
  });

  it("does not open a picker over a disabled or readonly field", () => {
    const disabled = document.createElement("input");
    disabled.type = "date";
    disabled.disabled = true;
    mount(disabled).click();

    const readonly = document.createElement("input");
    readonly.type = "date";
    readonly.readOnly = true;
    document.body.appendChild(readonly);
    readonly.click();

    expect(showPicker).not.toHaveBeenCalled();
  });

  it("survives a browser whose showPicker throws", () => {
    // Safari < 16.4 and any detached input. A throw escaping the
    // handler would break every click listener on the document.
    showPicker.mockImplementation(() => {
      throw new Error("InvalidStateError");
    });
    const el = document.createElement("input");
    el.type = "date";
    expect(() => mount(el).click()).not.toThrow();
  });

  it("stops listening once unmounted", () => {
    const el = document.createElement("input");
    el.type = "date";
    document.body.appendChild(el);
    const { unmount } = render(<DatePickerAffordance />);
    unmount();
    el.click();
    expect(showPicker).not.toHaveBeenCalled();
  });
});
