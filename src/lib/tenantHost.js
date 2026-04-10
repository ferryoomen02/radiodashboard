/**
 * Bepaalt het station-subdomein (slug) uit Host, voor multi-tenant portal + publieke site.
 *
 * Productie: zet PUBLIC_BASE_DOMAIN=bijv. sonicwave.nl
 *   → easyfm.sonicwave.nl → slug "easyfm"
 *   → dashboard.sonicwave.nl of www → geen tenant (centraal)
 *
 * Lokaal zonder PUBLIC_BASE_DOMAIN:
 *   → easyfm.localhost → slug "easyfm"
 *   → localhost → centraal
 *
 * Later: custom domeinen per zender kunnen via aparte DB-kolom op Station worden gekoppeld.
 */

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "dashboard",
  "app",
  "api",
  "admin",
  "mail",
  "cdn",
  "static",
  "assets",
  "localhost",
]);

/**
 * @param {string} hostHeader — req.get("host"), evt. met poort
 * @returns {{ hostname: string, port: string }}
 */
export function parseHost(hostHeader) {
  if (!hostHeader || typeof hostHeader !== "string") {
    return { hostname: "", port: "" };
  }
  const lower = hostHeader.trim().toLowerCase();
  const colon = lower.indexOf(":");
  if (colon === -1) {
    return { hostname: lower, port: "" };
  }
  return { hostname: lower.slice(0, colon), port: lower.slice(colon + 1) };
}

/**
 * @param {import("express").Request} req
 * @returns {string | null} station-slug of null = centrale omgeving
 */
export function resolveTenantSlugFromRequest(req) {
  const devOverride =
    typeof req.query?.__tenant === "string" ? req.query.__tenant.trim().toLowerCase() : "";
  if (devOverride && process.env.NODE_ENV !== "production") {
    const safe = devOverride.replace(/[^a-z0-9-]/g, "");
    return safe || null;
  }

  const host = req.get("host") || "";
  const { hostname } = parseHost(host);
  if (!hostname) return null;

  const base = process.env.PUBLIC_BASE_DOMAIN?.trim().toLowerCase();
  if (base) {
    if (hostname === base) return null;
    if (hostname === `www.${base}`) return null;
    const suffix = `.${base}`;
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
      return sub;
    }
    return null;
  }

  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  return null;
}
