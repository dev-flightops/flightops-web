import Link from "next/link";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DownloadPdfButtonProps {
  flightId: string;
}

export function DownloadPdfButton({ flightId }: DownloadPdfButtonProps) {
  return (
    <Link
      href={`/api/dispatch/${flightId}/release.pdf`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button variant="outline" size="sm">
        <FileDown className="h-4 w-4" />
        Download PDF
      </Button>
    </Link>
  );
}
