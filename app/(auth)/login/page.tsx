import { fetchEnabledProviders } from "@/lib/api/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Fetched server-side so the SSO buttons are present in the initial HTML —
  // no flash-of-no-buttons while the page hydrates. fetchEnabledProviders
  // returns an empty list on backend hiccups so the credentials form still
  // renders no matter what.
  const { providers } = await fetchEnabledProviders();
  return <LoginForm providers={providers} />;
}
