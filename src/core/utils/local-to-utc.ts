import { find as geoTzFind } from "geo-tz";

/**
 * Convert a local hour string (e.g. "08:00") at a given lat/lng
 * to a UTC hour string (e.g. "13:00").
 *
 * Uses the geo-tz library to resolve the IANA timezone from coordinates,
 * then calculates the UTC offset for today.
 */
export function localHourToUtc(
  localHour: string,
  lat: number,
  lng: number,
): string {
  const [h, m] = localHour.split(":").map(Number);
  const tzNames = geoTzFind(lat, lng);
  const tz = tzNames[0] ?? "UTC";

  // Build a date string for today at the given local hour
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Use Intl to find the UTC offset for this timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  // Get the offset by comparing local representation to UTC
  const utcRef = new Date(`${dateStr}T12:00:00Z`);
  const parts = formatter.formatToParts(utcRef);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Parse offset like "GMT-5" or "GMT+5:30"
  const offsetMatch = offsetPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  let offsetMinutes = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0));
  }

  // UTC = local - offset
  const utcMinutes = h * 60 + m - offsetMinutes;
  // Normalize to 0-1439 range (wrap around midnight)
  const normalized = ((utcMinutes % 1440) + 1440) % 1440;
  const utcH = Math.floor(normalized / 60);
  const utcM = normalized % 60;

  return `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")}`;
}
