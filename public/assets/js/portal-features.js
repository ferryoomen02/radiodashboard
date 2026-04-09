import { getAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";

/** Minimale keys zodat super_admin-nav nooit leeg raakt (fallback bij API/cache-fout). */
export const SUPER_NAV_FALLBACK_KEYS = [
  "dashboard",
  "tracks",
  "stations",
  "users",
  "invites",
  "media",
  "djs",
  "audiologger",
  "files",
  "site_settings",
];

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
    const fallbackKeys =
      role === "SUPER_ADMIN" ? [...SUPER_NAV_FALLBACK_KEYS] : [];
    cache = {
      stationId: null,
      enabledKeys: new Set(fallbackKeys),
      labelByKey: {},
    };
    return cache;
  }

  const data = await res.json();
  let keys = Array.isArray(data.enabledKeys) ? data.enabledKeys : [];
  if (role === "SUPER_ADMIN") {
    keys = [...new Set([...keys, ...SUPER_NAV_FALLBACK_KEYS])];
  }
  cache = {
    stationId: data.stationId ?? null,
    enabledKeys: new Set(keys),
    labelByKey: typeof data.labelByKey === "object" && data.labelByKey ? data.labelByKey : {},
  };
  if (role === "SUPER_ADMIN" && cache.enabledKeys.size === 0) {
    SUPER_NAV_FALLBACK_KEYS.forEach((k) => cache.enabledKeys.add(k));
  }
  return cache;
}

export function hasActiveFeature(key) {
  return cache?.enabledKeys?.has(key) ?? false;
}
