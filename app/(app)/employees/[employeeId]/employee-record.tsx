"use client";

import { useActionState } from "react";

import type { UserResponse } from "@/lib/api/types";

import { saveEmployeeAction, type SaveEmployeeState } from "./actions";
import { EmployeeRecordForm } from "./employee-record-form";

/**
 * Stateful shell. Everything visible lives in EmployeeRecordForm so it
 * can be rendered in a test — useActionState does not work under React 18
 * in vitest, and importing the server action drags in next/server.
 */
export function EmployeeRecord({ employee }: { employee: UserResponse }) {
  const [state, action, pending] = useActionState<SaveEmployeeState, FormData>(
    saveEmployeeAction,
    { status: "idle" },
  );

  return (
    <EmployeeRecordForm
      employee={employee}
      state={state}
      action={action}
      pending={pending}
    />
  );
}
