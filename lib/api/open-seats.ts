/**
 * Seats a no-show opened, and the texts to the passengers waiting for one
 * (#120): ops' /open-seats. And the company's text-message account they
 * go out from: /integrations/text-messages.
 */

import { apiFetch } from "@/lib/api/client";

export interface OpenLeg {
  origin: string;
  destination: string;
  /** Seats open on the leg. */
  open: number;
}

export type PassengerTextStatus = "not_sent" | "sent" | "failed";

export interface PassengerText {
  id: string;
  to_name: string;
  to_phone: string;
  body: string;
  status: PassengerTextStatus;
  /** no_account, phone_not_usable, or what the provider said. */
  reason: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface OpeningPassenger {
  id: string;
  /** "Last, First". */
  name: string;
  boards_at: string;
  leaves_at: string;
  phone: string | null;
  /** The text about this opening, for a waiting passenger told of it. */
  text: PassengerText | null;
}

/** A flight with seats a no-show left open. */
export interface Opening {
  flight_id: string;
  flight_number: string;
  tail_number: string | null;
  scheduled_departure_at: string;
  stops: string[];
  legs: OpenLeg[];
  no_shows: OpeningPassenger[];
  /** Standby and waitlisted passengers whose legs all have a seat open. */
  waiting: OpeningPassenger[];
  occurred_at: string;
  /** The company's text-message account is set up and switched on. */
  can_text: boolean;
}

/** The openings this person should see: dispatch all of them, an agent
 *  the ones with a seat from their station. */
export async function listOpenSeats(): Promise<Opening[]> {
  return apiFetch<Opening[]>("/ops/open-seats");
}

/** One flight's opening; null when it has none. */
export async function getFlightOpening(flightId: string): Promise<Opening | null> {
  return apiFetch<Opening | null>(`/ops/open-seats/flights/${encodeURIComponent(flightId)}`);
}

/** Text the waiting passengers not yet told, and send the kept texts. */
export async function textOpening(flightId: string): Promise<Opening | null> {
  return apiFetch<Opening | null>(`/ops/open-seats/flights/${encodeURIComponent(flightId)}/text`, {
    method: "POST",
  });
}

export interface TextAccount {
  provider: "twilio";
  account_sid: string | null;
  /** Never the token itself. */
  has_token: boolean;
  from_number: string | null;
  enabled: boolean;
  /** Set up and switched on: texts go. */
  ready: boolean;
  account_name: string | null;
  checked_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

const ACCOUNT = "/ops/integrations/text-messages";

export async function getTextAccount(): Promise<TextAccount> {
  return apiFetch<TextAccount>(ACCOUNT);
}

export async function updateTextAccount(body: {
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
  enabled?: boolean;
}): Promise<TextAccount> {
  return apiFetch<TextAccount>(ACCOUNT, { method: "PUT", body: JSON.stringify(body) });
}

export async function disconnectTextAccount(): Promise<TextAccount> {
  return apiFetch<TextAccount>(`${ACCOUNT}/token`, { method: "DELETE" });
}

export async function testTextAccount(): Promise<TextAccount> {
  return apiFetch<TextAccount>(`${ACCOUNT}/test`, { method: "POST" });
}
