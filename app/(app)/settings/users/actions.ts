"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createUser,
  deactivateUser,
  setUserPassword,
  updateUser,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * /settings/users server actions — four cover the admin CRUD set:
 * createUserAction (with 409 on duplicate email + 422 on unknown role),
 * updateUserAction (partial edit + self-edit guard from backend),
 * setPasswordAction (separate flow so password lives apart from name/roles
 * edits), and deactivateUserAction (soft-delete; backend rejects self).
 *
 * Roles are submitted as comma-separated form values (the multi-checkbox
 * UI renders one input per role); parsed back into a string[] before
 * the API call. Empty input = `[]` (no roles).
 */

const emailField = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254)
  .regex(/.+@.+/, "Invalid email");

const fullNameField = z.string().trim().min(1, "Name is required").max(120);

const rolesField = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v ? [v] : []))
  .pipe(z.array(z.string().min(1).max(40)).max(20));

const passwordField = z.string().min(8, "Min 8 characters").max(200);

export type UsersActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

function _formatErrors(parsed: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function _apiErrorState(err: unknown, action: string): UsersActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 403) {
      return {
        status: "api-error",
        message: "Only an Executive Admin can do that.",
      };
    }
    if (err.status === 409) {
      // Backend uses 409 for duplicate email AND self-edit guard rails.
      // The body shape differs slightly — both are surfaced as user-friendly
      // top-level errors rather than per-field so the message is the source
      // of truth.
      const detail = (err.message || "").toLowerCase();
      if (detail.includes("already exists")) {
        return {
          status: "field-errors",
          errors: { email: "A user with that email already exists." },
        };
      }
      if (detail.includes("cannot_change_own_roles")) {
        return {
          status: "api-error",
          message: "You can't change your own roles.",
        };
      }
      if (detail.includes("cannot_deactivate_self")) {
        return {
          status: "api-error",
          message: "You can't deactivate your own account.",
        };
      }
      return { status: "api-error", message: err.message };
    }
    if (err.status === 422) {
      const detail = (err.message || "").toLowerCase();
      if (detail.includes("unknown role")) {
        return {
          status: "field-errors",
          errors: { roles: "One or more roles isn't in the role catalog." },
        };
      }
      return { status: "api-error", message: err.message };
    }
    return {
      status: "api-error",
      message: `Couldn't ${action} (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return {
    status: "api-error",
    message: `Couldn't ${action}. Try again in a moment.`,
  };
}

const CreateSchema = z.object({
  email: emailField,
  full_name: fullNameField,
  roles: rolesField,
  password: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function createUserAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  // FormData → object — multiple roles[] values collapse to an array.
  const raw: Record<string, unknown> = {};
  for (const key of new Set(Array.from(formData.keys()))) {
    const values = formData.getAll(key);
    raw[key] = values.length > 1 ? values.map(String) : String(values[0]);
  }
  const parsed = CreateSchema.safeParse({
    email: raw.email,
    full_name: raw.full_name,
    roles: formData.getAll("roles").map(String),
    password: raw.password ?? "",
  });
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  // Validate password length only when non-null.
  if (parsed.data.password !== null) {
    const pw = passwordField.safeParse(parsed.data.password);
    if (!pw.success) {
      return {
        status: "field-errors",
        errors: { password: pw.error.issues[0].message },
      };
    }
  }
  try {
    await createUser({
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      roles: parsed.data.roles,
      password: parsed.data.password,
    });
  } catch (err) {
    return _apiErrorState(err, "add the user");
  }
  revalidatePath("/settings/users");
  revalidatePath("/settings");
  return { status: "ok" };
}

const UpdateSchema = z.object({
  full_name: fullNameField.optional(),
  is_active: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
});

export async function updateUserAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) {
    return {
      status: "api-error",
      message: "Missing user id — refresh and try again.",
    };
  }
  const parsed = UpdateSchema.safeParse({
    full_name: formData.get("full_name") ?? undefined,
    is_active: formData.get("is_active") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  const rolesRaw = formData.getAll("roles").map(String);
  const rolesParsed = rolesField.safeParse(rolesRaw);
  if (!rolesParsed.success) {
    return {
      status: "field-errors",
      errors: { roles: rolesParsed.error.issues[0].message },
    };
  }
  try {
    await updateUser(userId, {
      full_name: parsed.data.full_name,
      roles: rolesParsed.data,
      is_active: parsed.data.is_active,
    });
  } catch (err) {
    return _apiErrorState(err, "save the user");
  }
  revalidatePath("/settings/users");
  return { status: "ok" };
}

export async function setPasswordAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) {
    return {
      status: "api-error",
      message: "Missing user id — refresh and try again.",
    };
  }
  const parsed = passwordField.safeParse(formData.get("password"));
  if (!parsed.success) {
    return {
      status: "field-errors",
      errors: { password: parsed.error.issues[0].message },
    };
  }
  try {
    await setUserPassword(userId, { password: parsed.data });
  } catch (err) {
    return _apiErrorState(err, "set the password");
  }
  revalidatePath("/settings/users");
  return { status: "ok" };
}

export async function deactivateUserAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) {
    return {
      status: "api-error",
      message: "Missing user id — refresh and try again.",
    };
  }
  try {
    await deactivateUser(userId);
  } catch (err) {
    return _apiErrorState(err, "deactivate the user");
  }
  revalidatePath("/settings/users");
  return { status: "ok" };
}
