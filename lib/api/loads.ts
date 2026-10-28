import { ApiError } from "@/lib/api/client";

/**
 * The loads a page can do without, kept track of (#138): each one that
 * fails gives its fallback, and the page can say what didn't load
 * (LoadFailedNotice) instead of showing it as empty.
 *
 * The client's customer dropdown was empty for three months because a
 * failed call came back as an empty list (#137). A refusal the viewer is
 * meant to get, a 403, or a 404 for a record that isn't there yet, is
 * not a failure: it gives the fallback and says nothing. An expired
 * session isn't either: it goes on to the error boundary, which asks
 * the person to sign in again.
 *
 *   const loads = new Loads();
 *   const [crew, grid] = await Promise.all([
 *     loads.or(getCrewOptions(id, "pic"), null, "the pilot list"),
 *     loads.or(getTypeQualificationGrid(), null, "the type qualifications"),
 *   ]);
 *   <LoadFailedNotice what={loads.failed} />
 */
export class Loads {
  private readonly failures: { order: number; what: string }[] = [];
  private count = 0;

  or<T, F>(load: Promise<T>, fallback: F, what: string, expected: readonly number[] = [403, 404]): Promise<T | F> {
    const order = this.count++;
    return load.catch((err: unknown) => {
      // A 401 is SessionExpiredError: for the boundary, not this page.
      if (err instanceof ApiError && err.status === 401) throw err;
      if (!(err instanceof ApiError && expected.includes(err.status))) {
        this.failures.push({ order, what });
      }
      return fallback;
    });
  }

  /** What failed, in the order the loads were asked for. */
  get failed(): string[] {
    return [...this.failures].sort((a, b) => a.order - b.order).map((f) => f.what);
  }
}
