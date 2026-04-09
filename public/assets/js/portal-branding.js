import { apiFetch, handleAuthFailure } from "./portal-api.js";

/** @type {Awaited<ReturnType<typeof fetchPlatformBranding>> | null} */
let cache = null;

export function defaultBranding() {
  return {
    platformName: "SonicWave",
    subtitle: "Platform",
    logoUrl: null,
    logoStorageKey: null,
    texts: {
      dashboardWelcomeTitle: "",
      dashboardWelcomeText: "",
    },
  };
}

/**
 * Publieke portal-instellingen (GET /api/platform-settings).
 * @param {boolean} [force]
 */
export async function fetchPlatformBranding(force = false) {
  if (cache && !force) return cache;
  const res = await apiFetch("/api/platform-settings");
  if (handleAuthFailure(res)) return defaultBranding();
  if (!res.ok) return defaultBranding();
  const data = await res.json().catch(() => null);
  if (!data) return defaultBranding();
  cache = {
    platformName: data.platformName || "SonicWave",
    subtitle: data.subtitle ?? "Platform",
    logoUrl: data.logoUrl || null,
    logoStorageKey: data.logoStorageKey || null,
    texts: {
      dashboardWelcomeTitle: data.texts?.dashboardWelcomeTitle ?? "",
      dashboardWelcomeText: data.texts?.dashboardWelcomeText ?? "",
    },
  };
  return cache;
}

export function clearPlatformBrandingCache() {
  cache = null;
}
