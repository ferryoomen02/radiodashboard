/**
 * Normaliseert een door gebruikers ingevoerde hostnaam voor Station.customPublicHost.
 * Geen protocol/pad/poort in de database.
 */
export function normalizePublicHostname(raw) {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0] ?? "";
  const colon = s.indexOf(":");
  if (colon !== -1) s = s.slice(0, colon);
  s = s.trim();
  if (!s) return null;
  if (s.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (s.startsWith(".") || s.endsWith(".")) return null;
  return s;
}
