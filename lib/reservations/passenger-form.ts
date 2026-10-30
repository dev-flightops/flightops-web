import type { BookingPassenger } from "@/lib/api/reservations";

/**
 * The passenger rows of a booking form (#137), in the order on the form;
 * a row with no first name is a row left empty. Shared by the new-booking
 * and edit-booking actions (#147), which as "use server" modules can't
 * export a helper themselves. A string is the first row that doesn't
 * check out, in words.
 */
export function passengersFromForm(formData: FormData): BookingPassenger[] | string {
  const firsts = formData.getAll("passenger_first_name").map(String);
  const lasts = formData.getAll("passenger_last_name").map(String);
  const weights = formData.getAll("passenger_weight_lbs").map(String);
  const notes = formData.getAll("passenger_notes").map(String);
  // Kept as they were when the edit form carries them through unshown.
  const bags = formData.getAll("passenger_baggage_lbs").map(String);
  const phones = formData.getAll("passenger_contact_phone").map(String);
  const emails = formData.getAll("passenger_contact_email").map(String);
  const people: BookingPassenger[] = [];
  for (let i = 0; i < firsts.length; i++) {
    const first = firsts[i].trim();
    if (!first) continue;
    const weightText = (weights[i] ?? "").trim();
    const weight = weightText === "" ? null : Number(weightText);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) {
      return `Passenger ${i + 1}'s weight should be 0-1000 lb.`;
    }
    const bagsText = (bags[i] ?? "").trim();
    const person: BookingPassenger = {
      first_name: first.slice(0, 80),
      last_name: (lasts[i] ?? "").trim().slice(0, 80),
      weight_lbs: weight,
      notes: (notes[i] ?? "").trim().slice(0, 500) || null,
    };
    if (bagsText !== "" && Number.isFinite(Number(bagsText))) person.baggage_lbs = Number(bagsText);
    if ((phones[i] ?? "").trim()) person.contact_phone = phones[i].trim();
    if ((emails[i] ?? "").trim()) person.contact_email = emails[i].trim();
    people.push(person);
  }
  return people;
}
