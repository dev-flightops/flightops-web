import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The requirement admin actions.
 *
 * Every employee's checklist is built from this list, so the
 * validation worth pinning is the part that decides what a checklist
 * can SAY: a role that does not exist would scope a requirement to
 * nobody, silently, and a bad reminder window would be a database
 * error in front of an operator.
 */

const {
  createDocumentRequirement,
  updateDocumentRequirement,
  deactivateDocumentRequirement,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    createDocumentRequirement: vi.fn(),
    updateDocumentRequirement: vi.fn(),
    deactivateDocumentRequirement: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/employee-documents", () => ({
  createDocumentRequirement,
  updateDocumentRequirement,
  deactivateDocumentRequirement,
}));

import {
  createRequirementAction,
  retireRequirementAction,
  updateRequirementAction,
} from "./actions";

beforeEach(() => {
  createDocumentRequirement.mockReset().mockResolvedValue({ id: "r-1" });
  updateDocumentRequirement.mockReset().mockResolvedValue({ id: "r-1" });
  deactivateDocumentRequirement.mockReset().mockResolvedValue(undefined);
  revalidatePath.mockReset();
});

describe("creating one", () => {
  it("trims the name and sends it", async () => {
    const r = await createRequirementAction({ name: "  Medical  " });
    expect(r.ok).toBe(true);
    expect(createDocumentRequirement).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Medical" }),
    );
  });

  it("refuses a blank name by name", async () => {
    const r = await createRequirementAction({ name: "   " });
    expect(r).toEqual({ ok: false, error: "Give the requirement a name." });
    expect(createDocumentRequirement).not.toHaveBeenCalled();
  });

  it("accepts an empty role list, which means everyone", async () => {
    const r = await createRequirementAction({
      name: "Passport",
      applies_to_roles: [],
    });
    expect(r.ok).toBe(true);
  });

  it("refuses a role that does not exist", async () => {
    // It would scope the requirement to nobody, silently — the same
    // class of bug lib/roles.ts exists to stop in page gates.
    const r = await createRequirementAction({
      name: "Medical",
      applies_to_roles: ["pilot", "captain"],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/captain/);
    expect(createDocumentRequirement).not.toHaveBeenCalled();
  });

  it("accepts every role the app knows about", async () => {
    const r = await createRequirementAction({
      name: "Medical",
      applies_to_roles: ["pilot", "chief_pilot", "director_of_operations"],
    });
    expect(r.ok).toBe(true);
  });
});

describe("the reminder window", () => {
  it.each([-1, 3651, 1.5, Number.NaN])(
    "refuses %s with a message rather than a database error",
    async (reminder_days) => {
      const r = await createRequirementAction({
        name: "Medical",
        reminder_days,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/whole number of days/);
      expect(createDocumentRequirement).not.toHaveBeenCalled();
    },
  );

  it("accepts zero, which warns only on the day", async () => {
    const r = await createRequirementAction({
      name: "Medical",
      reminder_days: 0,
    });
    expect(r.ok).toBe(true);
  });
});

describe("retiring one", () => {
  it("deactivates rather than deleting", async () => {
    // The service keeps the row so documents already filed against it
    // stay readable — a certificate somebody filed is a record even
    // after the operator stops requiring it.
    const r = await retireRequirementAction("r-1");
    expect(r.ok).toBe(true);
    expect(deactivateDocumentRequirement).toHaveBeenCalledWith("r-1");
  });

  it("can be put back in use", async () => {
    await updateRequirementAction("r-1", { is_active: true });
    expect(updateDocumentRequirement).toHaveBeenCalledWith("r-1", {
      is_active: true,
    });
  });
});

describe("revalidation", () => {
  it("refreshes the employee records, whose checklists come from this list", async () => {
    await createRequirementAction({ name: "Medical" });
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/settings/document-requirements");
    // Layout-wide: every employee's checklist and its outstanding
    // badge is built from these requirements.
    expect(revalidatePath).toHaveBeenCalledWith("/employees", "layout");
  });
});

describe("refusals", () => {
  it("names the permission needed on a 403", async () => {
    createDocumentRequirement.mockRejectedValueOnce(
      new TestApiError(403, "/employee-documents/requirements", "nope"),
    );
    const r = await createRequirementAction({ name: "Medical" });
    expect(r.error).toMatch(/Exec Admin/);
  });

  it("passes the service's own message through on a 409", async () => {
    // "a requirement named 'Medical' already exists" is something the
    // operator can act on.
    createDocumentRequirement.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/employee-documents/requirements",
        JSON.stringify({ detail: "a requirement named 'Medical' already exists" }),
      ),
    );
    const r = await createRequirementAction({ name: "Medical" });
    expect(r.error).toBe("a requirement named 'Medical' already exists");
  });

  it("does not put a raw body on screen when it is not JSON", async () => {
    // Rendering the raw response is how /customers/{id} ends up
    // showing {"detail":"insufficient_role"} to a user.
    createDocumentRequirement.mockRejectedValueOnce(
      new TestApiError(400, "/employee-documents/requirements", "<html>502</html>"),
    );
    const r = await createRequirementAction({ name: "Medical" });
    expect(r.error).toBe("Couldn't create it.");
  });

  it("falls back on a 500 rather than guessing", async () => {
    createDocumentRequirement.mockRejectedValueOnce(
      new TestApiError(500, "/employee-documents/requirements", "boom"),
    );
    const r = await createRequirementAction({ name: "Medical" });
    expect(r.error).toBe("Couldn't create it.");
  });
});
