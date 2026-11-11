/**
 * Labels for the drug and alcohol program, as the services word them. The
 * test types and results are fixed: they are the DOT MIS form's rows and
 * columns (49 CFR 40 appendix J).
 */

import type {
  ClearanceReason,
  CollectorKind,
  EntryStatus,
  FaaCategory,
  FileKind,
  SelectionPanel,
  TestType,
} from "@/lib/api/drug-alcohol";

export const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: "pre_employment", label: "Pre-Employment" },
  { value: "random", label: "Random" },
  { value: "post_accident", label: "Post-Accident" },
  { value: "reasonable_suspicion", label: "Reasonable Suspicion/Cause" },
  { value: "return_to_duty", label: "Return-to-Duty" },
  { value: "follow_up", label: "Follow-Up" },
];

export const DRUG_RESULTS: { value: string; label: string }[] = [
  { value: "negative", label: "Negative" },
  { value: "negative_dilute", label: "Negative, dilute" },
  { value: "positive", label: "Positive" },
  { value: "positive_dilute", label: "Positive, dilute" },
  { value: "refusal", label: "Refusal to test" },
  { value: "cancelled", label: "Cancelled" },
];

/** What's entered for an alcohol test: the levels, from which the service
 *  works out the result, or a refusal, or a cancelled test. */
export const ALCOHOL_OUTCOMES: { value: string; label: string }[] = [
  { value: "completed", label: "Completed: enter the levels" },
  { value: "refusal", label: "Refusal to test" },
  { value: "cancelled", label: "Cancelled" },
];

export const DRUG_CLASSES: { value: string; label: string }[] = [
  { value: "marijuana", label: "Marijuana" },
  { value: "cocaine", label: "Cocaine" },
  { value: "pcp", label: "PCP" },
  { value: "opioids", label: "Opioids" },
  { value: "amphetamines", label: "Amphetamines" },
];

export const DRUG_REFUSALS: { value: string; label: string }[] = [
  { value: "adulterated", label: "Adulterated" },
  { value: "substituted", label: "Substituted" },
  { value: "shy_bladder", label: "Shy bladder, no medical explanation" },
  { value: "other", label: "Other refusal to submit" },
];

export const ALCOHOL_REFUSALS: { value: string; label: string }[] = [
  { value: "shy_lung", label: "Shy lung, no medical explanation" },
  { value: "other", label: "Other refusal to submit" },
];

export const FAA_CATEGORIES: { value: FaaCategory; label: string }[] = [
  { value: "flight_crewmember", label: "Flight Crewmember" },
  { value: "flight_attendant", label: "Flight Attendant" },
  { value: "flight_instructor", label: "Flight Instructor" },
  { value: "aircraft_dispatcher", label: "Aircraft Dispatcher" },
  { value: "maintenance", label: "Maintenance" },
  { value: "ground_security_coordinator", label: "Ground Security Coordinator" },
  { value: "aviation_screener", label: "Aviation Screener" },
  { value: "air_traffic_controller", label: "Air Traffic Controller" },
  { value: "operations_control_specialist", label: "Operations Control Specialist" },
];

export const COLLECTOR_KINDS: { value: CollectorKind; label: string }[] = [
  { value: "collection_site", label: "Collection site" },
  { value: "mro", label: "Medical Review Officer" },
  { value: "lab", label: "Laboratory" },
  { value: "ctpa", label: "Consortium / TPA" },
];

export const FILE_KINDS: { value: FileKind; label: string }[] = [
  { value: "chain_of_custody", label: "Custody and control form" },
  { value: "lab_results", label: "Lab results" },
  { value: "mro_letter", label: "MRO letter" },
  { value: "other", label: "Other" },
];

export const PANEL_LABEL: Record<SelectionPanel, string> = {
  drug: "Drug",
  alcohol: "Alcohol",
  both: "Drug and alcohol",
};

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  selected: "Selected",
  notified: "Notified",
  tested: "Tested",
  excused: "Excused",
};

/** Why someone isn't cleared, as the DER reads it. Only the DER, the Exec
 *  Admins and the person themselves ever see these. */
export const REASON_TEXT: Record<ClearanceReason, string> = {
  no_pre_employment: "No negative pre-employment drug test on file",
  violation: "Removed from duty: a violation with no negative return-to-duty test since",
  alcohol_hold: "Off duty after an alcohol result of 0.02 to 0.039",
};

export function labelOf(options: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function categoryLabel(value: string | null | undefined): string {
  return value ? labelOf(FAA_CATEGORIES, value) : "Not set";
}
