import { isSuperAdmin } from "../constants/roles.js";

/**
 * Zet req.effectiveStationId voor radio-endpoints.
 * - SUPER_ADMIN: stationId uit body (POST), query (GET) of header X-Station-Id
 * - Anders: vaste koppeling user.stationId
 */
export function attachEffectiveStation(req, res, next) {
  const { user } = req;
  if (isSuperAdmin(user)) {
    let sid = req.body?.stationId;
    if (typeof sid === "string") sid = sid.trim() || null;
    if (!sid && req.query?.stationId) {
      sid = String(req.query.stationId).trim() || null;
    }
    if (!sid && req.headers["x-station-id"]) {
      sid = String(req.headers["x-station-id"]).trim() || null;
    }
    req.effectiveStationId = sid;
  } else {
    req.effectiveStationId = user.stationId || null;
  }
  next();
}

export function requireEffectiveStation(req, res, next) {
  if (!req.effectiveStationId) {
    if (isSuperAdmin(req.user)) {
      return res.status(400).json({
        error:
          "Kies een zender: zet stationId in de query (GET), body (POST) of header X-Station-Id.",
      });
    }
    return res.status(403).json({ error: "Geen zender gekoppeld aan dit account." });
  }
  next();
}

/** Voorkomt dat station_admin/user een andere zender imiteert. */
export function enforceStationScope(req, res, next) {
  if (isSuperAdmin(req.user)) return next();
  if (!req.user.stationId || req.user.stationId !== req.effectiveStationId) {
    return res.status(403).json({ error: "Geen toegang tot deze zender." });
  }
  next();
}
