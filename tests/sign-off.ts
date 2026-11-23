import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** The mechanic every sign-off test signs as (1119-19). */
export const SIGNER = { signer_name: "Ray Torres", cert_number: "3521876", cert_type: "ap", airworthy: true } as const;

/** Fill a sign-off's fields: the work, the mechanic, their certificate
 *  and its kind, and the statement. */
export async function fillSignOff(user: UserEvent, work = "Replaced bulb; ops check good."): Promise<void> {
  await user.type(screen.getByLabelText(/^(Work done|Repair done|Resolution: what was done)$/), work);
  await user.type(screen.getByLabelText("Mechanic"), SIGNER.signer_name);
  await user.type(screen.getByLabelText("Certificate number"), SIGNER.cert_number);
  await user.selectOptions(screen.getByLabelText("Certificate"), SIGNER.cert_type);
  await user.click(screen.getByRole("checkbox", { name: /leaves the aircraft airworthy/ }));
}
