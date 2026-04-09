import { isSuperAdmin } from "../constants/roles.js";
import { stationHasAllFeatures } from "../lib/featureService.js";

/**
 * Controleert of de zender (effectiveStationId) alle opgegeven features heeft.
 * Super admins slaan we over (kunnen alles bedienen).
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
    const ok = await stationHasAllFeatures(stationId, keys);
    if (!ok) {
      return res.status(403).json({
        error: `Deze functie staat uit voor deze zender (${keys.join(", ")}).`,
      });
    }
    next();
  };
}

/**
 * Voor routes zonder effectiveStationId (bv. users-API): gebruik user.stationId.
 */
export function requireUserStationFeature(featureKey) {
  return async (req, res, next) => {
    if (isSuperAdmin(req.user)) {
      return next();
    }
    const stationId = req.user.stationId;
    if (!stationId) {
      return res.status(403).json({ error: "Geen zender gekoppeld." });
    }
    const ok = await stationHasAllFeatures(stationId, [featureKey]);
    if (!ok) {
      return res.status(403).json({
        error: `Functie '${featureKey}' staat uit voor deze zender.`,
      });
    }
    next();
  };
}
