/**
 * A passenger's bags, one by one. The client, 18 Nov: "Yes each bag should
 * have it's own weight. This way we can also have an accountability for
 * carry on bag weight." And: "for tracking purposes we need some sort of
 * notes section so we can write in description of bag, in case it gets
 * bumped or lost."
 *
 * Gate check-in and the manifest list each bag: its weight, carried on or
 * checked, and what it looks like. The passenger's baggage_lbs and
 * bags_count are the weight and the number of their bags aboard, so weight
 * and balance and every total read them as before. A passenger whose bags
 * were never listed has a total alone.
 */

export interface Bag {
  id: string;
  weight_lbs: string;
  carry_on: boolean;
  description: string | null;
  status: "aboard" | "bumped";
  /** Where a bumped bag waits for a later flight. */
  waiting_load_id?: string | null;
  bumped_at?: string | null;
}

/** A bag as check-in and the manifest send it. */
export interface BagInput {
  weight_lbs: number;
  carry_on: boolean;
  description: string | null;
}

/** A bag being typed in, its weight as typed. */
export interface BagDraft {
  key: string;
  weight: string;
  carryOn: boolean;
  description: string;
}

/** What one passenger may check in, as the services hold it. */
export const MAX_BAGS = 50;
export const MAX_BAGS_LBS = 2000;

export function aboard(bags: readonly Bag[] | undefined): Bag[] {
  return (bags ?? []).filter((bag) => bag.status === "aboard");
}

let drafted = 0;

export function newDraft(): BagDraft {
  drafted += 1;
  return { key: `new-bag-${drafted}`, weight: "", carryOn: false, description: "" };
}

/** The passenger's bags aboard, to edit. */
export function draftsFrom(bags: readonly Bag[] | undefined): BagDraft[] {
  return aboard(bags).map((bag) => ({
    key: bag.id,
    weight: String(Number(bag.weight_lbs)),
    carryOn: bag.carry_on,
    description: bag.description ?? "",
  }));
}

export function bagInputs(drafts: readonly BagDraft[]): BagInput[] {
  return drafts.map((draft) => ({
    weight_lbs: Number(draft.weight),
    carry_on: draft.carryOn,
    description: draft.description.trim() || null,
  }));
}

const tenth = (lbs: number) => Math.round(lbs * 10) / 10;

function weighs(bags: readonly { weight_lbs: string | number }[]): number {
  return tenth(bags.reduce((sum, bag) => sum + (Number(bag.weight_lbs) || 0), 0));
}

const fmt = (lbs: number) => lbs.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** "2 bags, 52.5 lb (1 carry-on, 12.5 lb)", or "No bags". */
export function bagsSummary(bags: readonly { weight_lbs: string | number; carry_on: boolean }[]): string {
  if (bags.length === 0) return "No bags";
  const carried = bags.filter((bag) => bag.carry_on);
  const text = `${bags.length} ${bags.length === 1 ? "bag" : "bags"}, ${fmt(weighs(bags))} lb`;
  return carried.length ? `${text} (${carried.length} carry-on, ${fmt(weighs(carried))} lb)` : text;
}

/** One bag as a line: "40 lb, carry-on: Black duffel, red tag". */
export function bagLine(bag: { weight_lbs: string | number; carry_on: boolean; description: string | null }): string {
  const head = `${fmt(tenth(Number(bag.weight_lbs) || 0))} lb${bag.carry_on ? ", carry-on" : ""}`;
  return bag.description ? `${head}: ${bag.description}` : head;
}

/** The bags a form posted as its "bags" field (JSON), checked: null when
 *  it posted none, "invalid" when they don't hold up. */
export function bagsFromForm(raw: FormDataEntryValue | null): BagInput[] | null | "invalid" {
  if (raw === null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return "invalid";
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_BAGS) return "invalid";
  const bags: BagInput[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) return "invalid";
    const { weight_lbs, carry_on, description } = item as Record<string, unknown>;
    const weight = Number(weight_lbs);
    if (!Number.isFinite(weight) || weight < 0 || weight > MAX_BAGS_LBS) return "invalid";
    if (description != null && (typeof description !== "string" || description.length > 200)) return "invalid";
    bags.push({
      weight_lbs: weight,
      carry_on: carry_on === true,
      description: typeof description === "string" ? description.trim() || null : null,
    });
  }
  return weighs(bags) > MAX_BAGS_LBS ? "invalid" : bags;
}
