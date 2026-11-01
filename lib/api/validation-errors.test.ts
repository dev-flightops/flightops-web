import { describe, expect, it } from "vitest";

import { refusalText, validationProblems, validationSummary } from "./validation-errors";

/** The 422 a customer's email on a reserved domain gets (#134). */
const reservedEmail = {
  status: 422,
  message: JSON.stringify({
    detail: [
      {
        type: "value_error",
        loc: ["body", "email"],
        msg: "value is not a valid email address: The part after the @-sign is a special-use or reserved name that cannot be used with email.",
        input: "sweep@example.test",
      },
    ],
  }),
};

describe("validationProblems", () => {
  it("names the field and says why, in a sentence", () => {
    expect(validationProblems(reservedEmail)).toEqual([
      {
        field: "email",
        message:
          "The part after the @-sign is a special-use or reserved name that cannot be used with email.",
      },
    ]);
  });

  it("reads a nested field and a model-level error", () => {
    const err = {
      status: 422,
      message: JSON.stringify({
        detail: [
          { loc: ["body", "passengers", 0, "weight_lbs"], msg: "Input should be greater than 0" },
          { loc: ["body"], msg: "Value error, Pick a return date after the departure" },
        ],
      }),
    };
    expect(validationProblems(err)).toEqual([
      { field: "weight_lbs", message: "Input should be greater than 0" },
      { field: null, message: "Pick a return date after the departure" },
    ]);
  });

  it("is empty for anything but a 422 with fields", () => {
    expect(validationProblems({ status: 409, message: JSON.stringify({ detail: "duplicate" }) })).toEqual([]);
    expect(validationProblems({ status: 422, message: "not json" })).toEqual([]);
    expect(validationProblems({ status: 422, message: JSON.stringify({ detail: "x" }) })).toEqual([]);
  });
});

describe("validationSummary", () => {
  it("is one line, with the form's own label where it has one", () => {
    expect(validationSummary(reservedEmail, { email: "Email address" })).toBe(
      "Email address: The part after the @-sign is a special-use or reserved name that cannot be used with email.",
    );
    expect(validationSummary({ status: 500, message: "" })).toBeNull();
  });
});

describe("refusalText", () => {
  it("reads a detail code when there are no fields", () => {
    expect(refusalText({ status: 409, message: JSON.stringify({ detail: "duplicate_email" }) })).toBe(
      "Duplicate email",
    );
    expect(refusalText({ status: 500, message: "Internal Server Error" })).toBeNull();
  });
});
