"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  createRewardsTransaction,
  enrollRewardsMember,
  REWARDS_TRANSACTION_TYPES,
  type RewardsTransactionType,
} from "@/lib/api/rewards";

export type RewardsActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function enrollMemberAction(
  _prev: RewardsActionState,
  form: FormData,
): Promise<RewardsActionState> {
  const customer_id = String(form.get("customer_id") ?? "").trim();
  const enrolled_station = String(form.get("enrolled_station") ?? "")
    .trim()
    .toUpperCase();
  const notes = String(form.get("notes") ?? "").trim();

  if (!customer_id) {
    return { status: "error", message: "Pick a customer." };
  }
  try {
    await enrollRewardsMember({
      customer_id,
      enrolled_station: enrolled_station || undefined,
      notes: notes || undefined,
    });
    revalidatePath("/reservations/rewards");
    return { status: "ok", message: "Member enrolled." };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: "This customer is already enrolled.",
        };
      }
      return {
        status: "error",
        message: `Backend error ${err.status}: ${err.message}`,
      };
    }
    return { status: "error", message: "Unexpected error." };
  }
}

export async function createTransactionAction(
  memberId: string,
  _prev: RewardsActionState,
  form: FormData,
): Promise<RewardsActionState> {
  const type_raw = String(form.get("transaction_type") ?? "").trim();
  const points_raw = String(form.get("points") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!(REWARDS_TRANSACTION_TYPES as readonly string[]).includes(type_raw)) {
    return { status: "error", message: "Pick a transaction type." };
  }
  const points = parseInt(points_raw, 10);
  if (!Number.isFinite(points) || points === 0) {
    return {
      status: "error",
      message: "Enter a non-zero point value.",
    };
  }

  try {
    await createRewardsTransaction(memberId, {
      transaction_type: type_raw as RewardsTransactionType,
      points,
      description: description || undefined,
    });
    revalidatePath(`/reservations/rewards/${memberId}`);
    revalidatePath("/reservations/rewards");
    return { status: "ok", message: "Transaction recorded." };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 422) {
        return {
          status: "error",
          message: "Insufficient balance for this redemption.",
        };
      }
      return {
        status: "error",
        message: `Backend error ${err.status}: ${err.message}`,
      };
    }
    return { status: "error", message: "Unexpected error." };
  }
}
