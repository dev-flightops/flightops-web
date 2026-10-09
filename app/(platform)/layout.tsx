/**
 * Platform administration (#63): creating and suspending operator
 * companies. Outside the operator app's shell, as the fuel supplier
 * portal is: a platform admin belongs to no operator, so there is no
 * operator nav, switcher or alert bell to show them.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
