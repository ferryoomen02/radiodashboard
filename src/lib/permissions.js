import { isSuperAdmin, isStationAdmin, isStaff } from "../constants/roles.js";
import { stationHasAllFeatures } from "./featureService.js";

export function normalizePermissions(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x) => typeof x === "string" && x.length > 0);
  }
  return [];
}

/**
 * Mag deze gebruiker alle opgegeven feature-keys gebruiken voor dit station?
 * Super: ja (mits station het heeft). Station admin eigen station: ja (mits station).
 * Staff: doorsnede van station-features en user.permissions.
 */
export async function userHasAllStationFeatures(user, stationId, keys) {
  if (!stationId || !keys?.length) return false;
  if (isSuperAdmin(user)) {
    return stationHasAllFeatures(stationId, keys);
  }
  const stationOk = await stationHasAllFeatures(stationId, keys);
  if (!stationOk) return false;
  if (isStationAdmin(user) && user.stationId === stationId) {
    return true;
  }
  if (isStaff(user) && user.stationId === stationId) {
    const perms = normalizePermissions(user.permissions);
    return keys.every((k) => perms.includes(k));
  }
  return false;
}
