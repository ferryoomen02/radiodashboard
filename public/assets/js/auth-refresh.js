import { getAuth, setAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { clearActiveFeaturesCache } from "./portal-features.js";
import { SONICWAVE_DEBUG } from "./portal-debug.js";

/**
 * Huidige gebruiker ophalen van /auth/me en localStorage bijwerken.
 * Voorkomt dat een oude rol (bijv. STAFF) in localStorage blijft staan terwijl de DB SUPER_ADMIN is.
 */
export async function refreshAuthProfile() {
  const auth = getAuth();
  if (!auth?.token) return null;
  const res = await apiFetch("/auth/me");
  if (handleAuthFailure(res)) {
    if (SONICWAVE_DEBUG) {
      console.warn("[SonicWave auth] refreshAuthProfile: afgebroken (401 of netwerk)", { hadRole: auth.user?.role });
    }
    return null;
  }
  if (!res.ok) {
    if (SONICWAVE_DEBUG) {
      console.warn("[SonicWave auth] refreshAuthProfile: /auth/me niet OK", res.status, { hadRole: auth.user?.role });
    }
    return null;
  }
  const data = await res.json().catch(() => null);
  if (!data?.user) {
    if (SONICWAVE_DEBUG) console.warn("[SonicWave auth] refreshAuthProfile: geen user in JSON");
    return null;
  }
  if (SONICWAVE_DEBUG) {
    console.log("[SonicWave auth] refreshAuthProfile: rol van server", data.user.role, "permissions", data.user.permissions);
  }
  setAuth({
    token: auth.token,
    user: data.user,
    station: data.station ?? null,
  });
  clearActiveFeaturesCache();
  return getAuth();
}
