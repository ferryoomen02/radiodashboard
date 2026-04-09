import { getAuth, setAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { clearActiveFeaturesCache } from "./portal-features.js";

/**
 * Huidige gebruiker ophalen van /auth/me en localStorage bijwerken.
 * Voorkomt dat een oude rol (bijv. STAFF) in localStorage blijft staan terwijl de DB SUPER_ADMIN is.
 */
export async function refreshAuthProfile() {
  const auth = getAuth();
  if (!auth?.token) return null;
  const res = await apiFetch("/auth/me");
  if (handleAuthFailure(res)) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.user) return null;
  setAuth({
    token: auth.token,
    user: data.user,
    station: data.station ?? null,
  });
  clearActiveFeaturesCache();
  return getAuth();
}
