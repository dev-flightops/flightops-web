import { redirect } from "next/navigation";

/**
 * The canonical home route is `/home` to match the legacy. `/` redirects
 * there so any old bookmarks (and Auth.js's default post-login redirect)
 * still land on the right page.
 */
export default function RootRedirect() {
  redirect("/home/");
}
