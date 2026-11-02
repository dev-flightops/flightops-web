"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { prepareDemo, type DemoPreparation } from "@/lib/api/demo";

export async function prepareDemoAction(companyName: string): Promise<
  { result: DemoPreparation; error?: never } | { error: string; result?: never }
> {
  try {
    const result = await prepareDemo(companyName);
    revalidatePath("/", "layout");
    return { result };
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : "Could not reach the demo service. Check the connection and try again." };
  }
}
