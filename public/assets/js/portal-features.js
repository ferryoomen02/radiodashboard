import { getAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { SONICWAVE_DEBUG, swPerf } from "./portal-debug.js";

/** Minimale keys zodat super_admin-nav nooit leeg raakt (fallback bij API-fout). */
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
  "platform_branding",
];

/** @type {{ enabledKeys: Set<string>, labelByKey: Record<string, string>, stationId: string | null } | null} */
let cache = null;

/** Parallelle GET /api/active-features (sidebar + dashboard) → één request. */
let featuresInFlight = null;

export function clearActiveFeaturesCache() {
  cache = null;
}

/**
 * Ingeladen feature-keys voor de actieve zender (sidebar + paginachecks).
 * Super zonder gekozen zender: API geeft volledige standaardlijst.
 *
 * @param {boolean} force
 * @param {{ role?: string, from?: string }} [opts] — `role` = bron van waarheid (bijv. net na /auth/me); voorkomt dat oude localStorage-rol de API-call verkeerd laat lopen.
 */
export async function fetchActiveFeatures(force = false, opts = {}) {
  if (cache && !force) return cache;
  if (featuresInFlight) {
    if (SONICWAVE_DEBUG) {
      console.debug("[SonicWave features] fetchActiveFeatures: dedupe — wacht op lopende request", opts.from);
    }
    return featuresInFlight;
  }
  featuresInFlight = fetchActiveFeaturesImpl(force, opts);
  try {
    return await featuresInFlight;
  } finally {
    featuresInFlight = null;
  }
}

async function fetchActiveFeaturesImpl(force, opts) {
  const auth = getAuth();
  if (!auth?.token) return null;

  const role = opts.role ?? auth.user?.role;
  const stationId =
    role === "SUPER_ADMIN"
      ? sessionStorage.getItem("sonicwaveActiveStationId")
      : auth.station?.id;

  const url = stationId
    ? `/api/active-features?stationId=${encodeURIComponent(stationId)}`
    : "/api/active-features";

  swPerf.featuresNetworkRequests += 1;
  const res = await apiFetch(url);
  if (handleAuthFailure(res)) return null;
  if (!res.ok) {
    if (opts.from && typeof console !== "undefined" && console.debug) {
      console.debug("[SonicWave features] active-features niet OK", { from: opts.from, status: res.status, role });
    }
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
  if (SONICWAVE_DEBUG) {
    console.debug("[SonicWave features] fetch klaar", {
      from: opts.from,
      role,
      keyCount: cache.enabledKeys.size,
    });
  }
  return cache;
}

export function hasActiveFeature(key) {
  return cache?.enabledKeys?.has(key) ?? false;
}
