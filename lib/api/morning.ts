import { apiFetch } from "./client";

export interface DayPreflight {
  id: string; aircraft_id: string; tail_number: string;
  pilot_user_id: string; pilot_name: string; company_date: string;
  picked_at: string; preflight_at: string | null;
  fuel_gallons: string | null; oil_quarts: string | null; notes: string | null;
}
export interface MorningResponse {
  company_date: string; on_duty: boolean; mine: DayPreflight | null;
  options: { aircraft_id: string; tail_number: string; model: string | null;
    base: string | null; available: boolean; reason: string | null }[];
}
export const getMorningAircraft = () => apiFetch<MorningResponse>("/ops/morning/aircraft");
export const pickMorningAircraft = (aircraftId: string) => apiFetch<DayPreflight>("/ops/morning/pick", {
  method: "POST", body: JSON.stringify({ aircraft_id: aircraftId }),
});
export const recordMorningPreflight = (id: string, body: {
  fuel_gallons: number | null; oil_quarts: number | null; notes: string | null;
}) => apiFetch<DayPreflight>(`/ops/morning/${id}/preflight`, {
  method: "POST", body: JSON.stringify(body),
});
