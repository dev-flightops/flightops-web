"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function DispatchError(props: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  return <ErrorScreen {...props} />;
}
