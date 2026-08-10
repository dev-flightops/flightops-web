"use client";

/**
 * Small client-only button that fires window.print(). The certificate
 * page is otherwise a Server Component, so this stays scoped —
 * printing renders the styled cert card + browser print dialog
 * without needing a PDF-generation service. When operators need
 * branded downloads the backend can add /certificates/{id}/pdf.
 */
export function PrintCertificateButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/10"
    >
      Print
    </button>
  );
}
