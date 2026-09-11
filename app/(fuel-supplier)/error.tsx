"use client";

import { ErrorScreen } from "@/components/error-screen";

/**
 * Error boundary for the fuel-supplier portal.
 *
 * `audience` is the whole point of this file. Suppliers are external
 * users on their own `fuel_supplier_session` cookie, so the default
 * staff re-login path would clear an Auth.js session they do not have
 * and land them on the staff sign-in page.
 */
export default function FuelSupplierError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} audience="fuel-supplier" />;
}
