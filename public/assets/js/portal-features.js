import { getAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";

/** @type {{ enabledKeys: Set<string>, labelByKey: Record<string, string>, stationId: string | null } | null} */
let cache = null;

export function clearActiveFeaturesCache() {
  cache = null;
}

/**
 * Ingeladen feature-keys voor de actieve zender (sidebar + paginachecks).
 * Super zonder gekozen zender: API geeft volledige standaardlijst.
 */
export async function fetchActiveFeatures(force = false) {
  if (cache && !force) return cache;
  const auth = getAuth();
  if (!auth?.token) return null;

  const role = auth.user?.role;
  const stationId =
    role === "SUPER_ADMIN"
      ? sessionStorage.getItem("sonicwaveActiveStationId")
      : auth.station?.id;

  const url = stationId
    ? `/api/active-features?stationId=${encodeURIComponent(stationId)}`
    : "/api/active-features";

  const res = await apiFetch(url);
  if (handleAuthFailure(res)) return null;
  if (!res.ok) {
    cache = {
      stationId: null,
      enabledKeys: new Set(),
      labelByKey: {},
    };
    return cache;
  }

  const data = await res.json();
  const keys = Array.isArray(data.enabledKeys) ? data.enabledKeys : [];
  cache = {
    stationId: data.stationId ?? null,
    enabledKeys: new Set(keys),
    labelByKey: typeof data.labelByKey === "object" && data.labelByKey ? data.labelByKey : {},
  };
  return cache;
}

export function hasActiveFeature(key) {
  return cache?.enabledKeys?.has(key) ?? false;
}
