/**
 * M3-X-2 — Fuel Supplier Portal layout.
 *
 * Separate from the main app shell — external supplier employees
 * don't need (or want) the dispatch nav, tenant switcher, etc. The
 * portal is a focused inbox + closeout surface for the orders
 * addressed to the supplier accounts they represent.
 *
 * Route-group syntax: (fuel-supplier) is stripped from the URL, so
 * paths under this layout are /fuel-supplier and /fuel-supplier/login.
 */

export default function FuelSupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
