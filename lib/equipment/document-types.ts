/** Legacy's GSE_DOC_TYPES, with their labels (#134). A plain module, so a
 *  client component can read it without pulling in the API client. */
export const GSE_DOCUMENT_TYPES = [
  { value: "manual", label: "Operator manual" },
  { value: "inspection", label: "Inspection record" },
  { value: "service_bulletin", label: "Service bulletin" },
  { value: "warranty", label: "Warranty" },
  { value: "registration", label: "Registration" },
  { value: "other", label: "Other" },
] as const;

export type GSEDocumentType = (typeof GSE_DOCUMENT_TYPES)[number]["value"];

export function documentTypeLabel(value: string): string {
  return GSE_DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}
