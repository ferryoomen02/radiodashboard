import { prisma } from "../db.js";
import { parseHost, resolveSubdomainTenantSlug } from "../lib/tenantHost.js";

/** @type {Map<string, { at: number, row: { id: string, slug: string } | null }>} */
const customHostLookupCache = new Map();
const CUSTOM_HOST_CACHE_MS = 120_000;

/**
 * Zet req.tenantSlug (station.slug) voor multi-tenant routes.
 * Volgorde: DB match op customPublicHost (ACTIVE) → subdomein + dev ?__tenant.
 */
export function attachTenantContext(req, res, next) {
  (async () => {
    try {
      req.tenantStationId = null;
      req.tenantResolvedBy = null;

      const host = req.get("host") || "";
      const { hostname } = parseHost(host);

      if (hostname) {
        let cached = customHostLookupCache.get(hostname);
        if (cached && Date.now() - cached.at < CUSTOM_HOST_CACHE_MS) {
          if (cached.row) {
            req.tenantSlug = cached.row.slug;
            req.tenantStationId = cached.row.id;
            req.tenantResolvedBy = "customHost";
            return next();
          }
        } else {
          const byHost = await prisma.station.findFirst({
            where: {
              customPublicHost: hostname,
              status: "ACTIVE",
            },
            select: { id: true, slug: true },
          });
          customHostLookupCache.set(hostname, {
            at: Date.now(),
            row: byHost,
          });
          if (byHost) {
            req.tenantSlug = byHost.slug;
            req.tenantStationId = byHost.id;
            req.tenantResolvedBy = "customHost";
            return next();
          }
        }
      }

      const sub = resolveSubdomainTenantSlug(req);
      req.tenantSlug = sub;
      if (sub) {
        req.tenantResolvedBy =
          process.env.NODE_ENV !== "production" && req.query?.__tenant ? "dev" : "subdomain";
      }
      next();
    } catch (err) {
      next(err);
    }
  })();
}
