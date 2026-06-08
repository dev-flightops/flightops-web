import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ flightId: string }>;
}

/**
 * `/dispatch/<uuid>` is a legacy URL — M1 had a separate flight-detail
 * page here with Edit + Release buttons, but as of M2-G-15 those
 * actions live on the unified dispatch packet at
 * `/dispatch?flight=<uuid>`. We keep this route as a server redirect so
 * old bookmarks and dashboard links still work.
 *
 * The redirect is permanent — if Next ever caches it, the new URL
 * stays the new URL.
 */
export default async function FlightDetailRedirect({ params }: Props) {
  const { flightId } = await params;
  redirect(`/dispatch?flight=${encodeURIComponent(flightId)}`);
}
