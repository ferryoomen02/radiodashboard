import { isSuperAdmin } from "../constants/roles.js";
import { userHasAllStationFeatures } from "../lib/permissions.js";

/**
 * Controleert station-features én (voor staff) gebruikersrechten.
 */
export function requireStationFeatures(...keys) {
  return async (req, res, next) => {
    if (isSuperAdmin(req.user)) {
      return next();
    }
    const stationId = req.effectiveStationId;
    if (!stationId) {
      return res.status(400).json({ error: "Geen zender in deze context." });
    }
    const ok = await userHasAllStationFeatures(req.user, stationId, keys);
    if (!ok) {
      return res.status(403).json({
        error: `Geen toegang tot deze functie (${keys.join(", ")}).`,
      });
    }
    next();
  };
}

export function requireUserStationFeature(featureKey) {
  return async (req, res, next) => {
    if (isSuperAdmin(req.user)) {
      return next();
    }
    const stationId = req.user.stationId;
    if (!stationId) {
      return res.status(403).json({ error: "Geen zender gekoppeld." });
    }
    const ok = await userHasAllStationFeatures(req.user, stationId, [featureKey]);
    if (!ok) {
      return res.status(403).json({
        error: `Geen toegang tot '${featureKey}' voor dit account.`,
      });
    }
    next();
  };
}
