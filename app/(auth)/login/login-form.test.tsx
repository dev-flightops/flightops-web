import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renders the brand block + form fields + sign-in button", () => {
    render(<LoginForm providers={[]} />);
    expect(screen.getByText("Peregrine Flight Ops")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in$/i })).toBeInTheDocument();
  });

  it("renders the legacy footer copy + Back to home link", () => {
    render(<LoginForm providers={[]} />);
    expect(
      screen.getByText(/Authorized users only/i),
    ).toBeInTheDocument();
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back).toHaveAttribute("href", "/home");
  });

  it("does NOT render the SSO divider when no providers are enabled", () => {
    render(<LoginForm providers={[]} />);
    expect(
      screen.queryByText(/or use password/i),
    ).not.toBeInTheDocument();
  });

  it("renders SSO buttons + divider when providers are present", () => {
    render(
      <LoginForm
        providers={[
          { id: "google", label: "Google" },
          { id: "microsoft-entra-id", label: "Microsoft" },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Sign in with Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign in with Microsoft/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/or use password/i)).toBeInTheDocument();
  });

  it("calls signIn('credentials', …) on submit and pushes /home on success", async () => {
    signIn.mockResolvedValue({ error: null, ok: true });
    push.mockReset();
    refresh.mockReset();
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), "admin@flightops.local");
    await user.type(screen.getByLabelText(/password/i), "flightops-dev");
    await user.click(screen.getByRole("button", { name: /sign in$/i }));

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "admin@flightops.local",
      password: "flightops-dev",
      redirect: false,
    });
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("shows an inline error when signIn returns an error", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), "wrong@flightops.local");
    await user.type(screen.getByLabelText(/password/i), "nope");
    await user.click(screen.getByRole("button", { name: /sign in$/i }));

    expect(
      await screen.findByText(/Invalid email or password/i),
    ).toBeInTheDocument();
  });

  it("calls signIn(provider) when an SSO button is clicked", async () => {
    signIn.mockReset();
    const user = userEvent.setup();
    render(<LoginForm providers={[{ id: "google", label: "Google" }]} />);

    await user.click(
      screen.getByRole("button", { name: /Sign in with Google/i }),
    );
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/home" });
  });

  it("has no WCAG A/AA violations on the default render", async () => {
    const { container } = render(<LoginForm providers={[]} />);
    await expectNoA11yViolations(container);
  });
});
