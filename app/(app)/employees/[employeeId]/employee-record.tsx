"use client";

import { useActionState } from "react";

import type {
  AirmanRecordResponse,
  DisqualificationListResponse,
  UserResponse,
} from "@/lib/api/types";

import { saveEmployeeAction, type SaveEmployeeState } from "./actions";
import { EmployeeRecordForm } from "./employee-record-form";

/**
 * Stateful shell. Everything visible lives in EmployeeRecordForm so it
 * can be rendered in a test — useActionState does not work under React 18
 * in vitest, and importing the server action drags in next/server.
 */
export function EmployeeRecord({
  employee,
  airman,
  disqualifications,
}: {
  employee: UserResponse;
  airman: AirmanRecordResponse | null;
  disqualifications: DisqualificationListResponse | null;
}) {
  const [state, action, pending] = useActionState<SaveEmployeeState, FormData>(
    saveEmployeeAction,
    { status: "idle" },
  );

  return (
    <EmployeeRecordForm
      employee={employee}
      airman={airman}
      disqualifications={disqualifications}
      state={state}
      action={action}
      pending={pending}
    />
  );
}
