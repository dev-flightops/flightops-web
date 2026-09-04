"use server";

import { revalidatePath } from "next/cache";

import { updateUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { EmploymentType, UserUpdateRequest } from "@/lib/api/types";

export interface SaveEmployeeState {
  status: "idle" | "saved" | "error";
  error?: string;
}

/** Fields the record form owns. Everything here is sent on every save,
 *  because the form shows them all — an omitted key means "leave alone"
 *  server-side, which would make clearing a field impossible from a form
 *  that renders it as an empty box. Empty string clears. */
const TEXT_FIELDS = [
  "first_name",
  "last_name",
  "preferred_name",
  "emp_number",
  "department",
  "title",
  "station",
  "phone",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "notes",
] as const;

const DATE_FIELDS = ["date_of_birth", "hire_date", "termination_date"] as const;

export async function saveEmployeeAction(
  _prev: SaveEmployeeState,
  formData: FormData,
): Promise<SaveEmployeeState> {
  const employeeId = String(formData.get("employee_id") ?? "");
  if (!employeeId) return { status: "error", error: "Missing employee." };

  const body: UserUpdateRequest = {};
  for (const field of TEXT_FIELDS) {
    body[field] = String(formData.get(field) ?? "").trim();
  }
  for (const field of DATE_FIELDS) {
    // A cleared date input submits "". The API takes null for "unset";
    // "" would fail date parsing before it ever reached the column.
    const raw = String(formData.get(field) ?? "").trim();
    body[field] = raw === "" ? null : raw;
  }
  // Narrowed rather than cast: the select only offers these four, but a
  // hand-posted form could send anything, and the API would answer 422
  // with nothing useful to show the user.
  const employmentType = String(formData.get("employment_type") ?? "").trim();
  const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
    "full_time",
    "part_time",
    "contract",
    "seasonal",
  ];
  if (employmentType === "") {
    body.employment_type = null;
  } else if ((EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
    body.employment_type = employmentType as EmploymentType;
  } else {
    return {
      status: "error",
      error: "That employment type is not one we use.",
    };
  }

  try {
    await updateUser(employeeId, body);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return {
          status: "error",
          error: "You need Exec Admin to edit this record.",
        };
      }
      if (err.status === 400) {
        // The only 400 this endpoint raises on these fields.
        return {
          status: "error",
          error: "Date of birth has to be in the past.",
        };
      }
      if (err.status === 422) {
        return {
          status: "error",
          error: "Something on the form was not valid.",
        };
      }
    }
    return { status: "error", error: "Could not save. Try again in a moment." };
  }

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { status: "saved" };
}
