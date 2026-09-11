import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const signOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOut(...args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ErrorScreen } from "./error-screen";

/** The exact string Next substitutes for a server-component throw in a
 *  production build. Hardcoded on purpose: if a Next upgrade reworded
 *  it, the assertion below is how we would find out, rather than a
 *  dispatcher reading it on a live incident. */
const NEXT_PRODUCTION_REDACTION =
  "An error occurred in the Server Components render. The specific message " +
  "is omitted in production builds to avoid leaking sensitive details. A " +
  "digest property is included on this error instance which may provide " +
  "additional details about the nature of the error.";

function err(message: string, name?: string, digest?: string) {
  const e = new Error(message) as Error & { digest?: string };
  if (name) e.name = name;
  if (digest) e.digest = digest;
  return e;
}

beforeEach(() => {
  signOut.mockReset();
  push.mockReset();
  refresh.mockReset();
  signOut.mockResolvedValue(undefined);
});

describe("ErrorScreen", () => {
  it("offers a retry for an ordinary failure", async () => {
    const reset = vi.fn();
    render(<ErrorScreen error={err("Upstream timed out")} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Upstream timed out")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("offers re-login, not retry, when the session has expired", async () => {
    // Class identity does not survive the server→client boundary; the
    // `name` property does, which is what apiFetch sets. A retry here
    // would fail identically every time, so the button must differ.
    render(
      <ErrorScreen
        error={err("anything", "SessionExpiredError")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /sign in again/i }),
    );

    // Auth.js cookie has to be cleared before /login, or proxy.ts sees a
    // logged-in user and bounces straight back into the failing page.
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("does not show a user Next's production redaction notice", () => {
    // The bug this guards: in a production build every server-component
    // throw arrives with the paragraph below as its message, and the
    // screen rendered it verbatim — React internals, talking about
    // digest properties, in front of a dispatcher. Invisible in dev,
    // where the real message is passed through and reads fine.
    render(
      <ErrorScreen
        error={err(NEXT_PRODUCTION_REDACTION, undefined, "abc123")}
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/digest property/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/omitted in production builds/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/retrying often clears it/i)).toBeInTheDocument();
    // The diagnostic route out is the ID, so it has to still be there.
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("falls back when the message is empty or whitespace", () => {
    // Next has a second variant ("...but no message was provided") and
    // a thrown non-Error can arrive with nothing at all.
    const { unmount } = render(<ErrorScreen error={err("")} reset={vi.fn()} />);
    expect(screen.getByText(/retrying often clears it/i)).toBeInTheDocument();
    unmount();

    render(<ErrorScreen error={err("   ")} reset={vi.fn()} />);
    expect(screen.getByText(/retrying often clears it/i)).toBeInTheDocument();
  });

  it("falls back on Next's other redaction variant too", () => {
    // Added because a mutation run caught this: removing the
    // "no message was provided" branch from the detector failed
    // nothing. The comment in error-screen.tsx claims both variants are
    // handled, so one of them was an unverified claim.
    render(
      <ErrorScreen
        error={err(
          "An error occurred in the Server Components render but no message was provided",
        )}
        reset={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/no message was provided/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/retrying often clears it/i)).toBeInTheDocument();
  });

  it("shows the error ID only when there is one", () => {
    const { unmount } = render(
      <ErrorScreen error={err("boom", undefined, "d1g3st")} reset={vi.fn()} />,
    );
    expect(screen.getByText("Error ID: d1g3st")).toBeInTheDocument();
    unmount();

    render(<ErrorScreen error={err("boom")} reset={vi.fn()} />);
    expect(screen.queryByText(/Error ID/)).not.toBeInTheDocument();
  });

  it("sends an expired fuel supplier to their own login, not the staff one", async () => {
    // The portal authenticates on its own fuel_supplier_session cookie.
    // Two things would be wrong with the staff path here: the supplier
    // would land on the staff sign-in page, and signOut() would clear an
    // Auth.js session that belongs to whoever else uses this browser.
    render(
      <ErrorScreen
        error={err("expired", "SessionExpiredError")}
        reset={vi.fn()}
        audience="fuel-supplier"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /sign in again/i }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fuel-supplier/login"),
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still clears the Auth.js cookie for staff", async () => {
    // The inverse of the above, so neither branch can quietly adopt the
    // other's behaviour.
    render(
      <ErrorScreen
        error={err("expired", "SessionExpiredError")}
        reset={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /sign in again/i }),
    );

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ErrorScreen error={err("boom", undefined, "x")} reset={vi.fn()} />,
    );
    await expectNoA11yViolations(container);
  });
});
