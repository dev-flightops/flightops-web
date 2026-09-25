/** The signed-out ground. Deliberately does no layout of its own: the
 *  login screen is a full-bleed split, and centring it in a padded flex
 *  box here left a white strip down one side of the photo. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
