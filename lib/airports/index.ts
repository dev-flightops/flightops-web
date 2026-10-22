import ALASKA from "./alaska.json";

/**
 * Alaska's airports, by every code a dispatcher might type (#108):
 * ICAO (PAKN), FAA (9Z8), and the GPS and local codes OurAirports keeps
 * beside them. Latitude, longitude and name.
 *
 * Built from OurAirports (https://ourairports.com/data/, public domain)
 * on 22 Oct 2026: its US-AK airports and seaplane bases, without the
 * closed ones and heliports. The new-flight form names each typed
 * airport and works out the legs' times from it. An airport that isn't
 * here leaves its times to be typed, as before.
 */

export interface Airport {
  code: string;
  latitude: number;
  longitude: number;
  name: string;
}

const TABLE = ALASKA as unknown as Record<string, [number, number, string]>;

export function findAirport(code: string | null | undefined): Airport | null {
  const key = (code ?? "").trim().toUpperCase();
  const row = key ? TABLE[key] : undefined;
  return row ? { code: key, latitude: row[0], longitude: row[1], name: row[2] } : null;
}

const EARTH_RADIUS_NM = 3440.065;

/** Great-circle distance in nautical miles. */
export function distanceNm(a: Airport, b: Airport): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
