"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { CUSTOMER_TYPES, type CustomerType, createCustomer } from "@/lib/api/reservations";

const _schema = z.object({
  full_name: z.string().trim().min(1, "Name is required.").max(200),
  company_name: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  customer_type: z.enum(CUSTOMER_TYPES as unknown as [string, ...string[]]),
  notes: z.string().trim().max(4000).optional(),
});

export interface NewCustomerFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function createCustomerAction(
  _prev: NewCustomerFormState,
  formData: FormData,
): Promise<NewCustomerFormState> {
  const parsed = _schema.safeParse({
    full_name: formData.get("full_name") ?? "",
    company_name: formData.get("company_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    customer_type: formData.get("customer_type") ?? "individual",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const v = parsed.data;
  let newId: string;
  try {
    const created = await createCustomer({
      full_name: v.full_name,
      company_name: v.company_name || null,
      email: v.email || null,
      phone: v.phone || null,
      customer_type: v.customer_type as CustomerType,
      notes: v.notes || null,
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: "A customer with that email already exists.",
          fieldErrors: { email: "Duplicate email in this tenant." },
        };
      }
      return {
        status: "error",
        message: `Backend rejected the request (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach reservations-service.",
    };
  }

  redirect(`/customers/${newId}?created=1`);
}
