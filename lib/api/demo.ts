import { apiFetch } from "./client";

export type DemoSummary = Record<string, number>;
export type DemoStatus = {
  enabled: boolean;
  company_name?: string;
  timezone?: string;
  company_date?: string;
  last_prepared_at?: string | null;
  last_company_date?: string | null;
  summary?: DemoSummary | null;
};
export type DemoPreparation = {
  prepared_at: string;
  company_date: string;
  timezone: string;
  summary: DemoSummary;
};
export const getDemoStatus = () => apiFetch<DemoStatus>("/ops/demo");
export const prepareDemo = (companyName: string) =>
  apiFetch<DemoPreparation>("/ops/demo/prepare", {
    method: "POST",
    body: JSON.stringify({ company_name: companyName }),
  });
