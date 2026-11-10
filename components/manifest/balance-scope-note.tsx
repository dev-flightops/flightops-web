/** The weight is checked here. Balance is the flight's ForeFlight plan's when
 *  one has come back (#181), else the aircraft's approved loading procedure. */
export function BalanceScopeNote() {
  return <p className="mt-3 text-xs text-muted-foreground">Weight check only — FlightOps doesn’t calculate the center of gravity. When the flight’s ForeFlight plan comes back, a weight or CG outside its limits there holds the release; otherwise verify balance using the aircraft’s approved loading procedure.</p>;
}
