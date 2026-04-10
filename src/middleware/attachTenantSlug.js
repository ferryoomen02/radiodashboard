import { resolveTenantSlugFromRequest } from "../lib/tenantHost.js";

export function attachTenantSlug(req, res, next) {
  req.tenantSlug = resolveTenantSlugFromRequest(req);
  next();
}
