/**
 * Maintenance vendors (#178): the shops and suppliers the company sends work
 * and orders parts to. The maintenance service's /mx-vendors.
 */

import { apiFetch } from "./client";

export interface MxVendor {
  id: string;
  name: string;
  vendor_type: string;
  type_label: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** The shop's FAA certificate, e.g. a Part 145 repair station number. */
  faa_cert: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface MxVendorInput {
  name: string;
  vendor_type: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  faa_cert: string | null;
  notes: string | null;
}

export async function listVendors(): Promise<MxVendor[]> {
  return apiFetch<MxVendor[]>(`/maintenance/mx-vendors`);
}

export async function listVendorTypes(): Promise<{ value: string; label: string }[]> {
  return apiFetch(`/maintenance/mx-vendors/types`);
}

export async function getVendor(id: string): Promise<MxVendor> {
  return apiFetch<MxVendor>(`/maintenance/mx-vendors/${id}`);
}

export async function createVendor(body: MxVendorInput): Promise<MxVendor> {
  return apiFetch<MxVendor>(`/maintenance/mx-vendors`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateVendor(id: string, body: MxVendorInput): Promise<MxVendor> {
  return apiFetch<MxVendor>(`/maintenance/mx-vendors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function removeVendor(id: string): Promise<void> {
  await apiFetch<void>(`/maintenance/mx-vendors/${id}`, { method: "DELETE" });
}
