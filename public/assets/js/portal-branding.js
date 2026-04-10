import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { swPerf } from "./portal-debug.js";

/** @type {Awaited<ReturnType<typeof fetchPlatformBranding>> | null} */
let cache = null;

/** Parallelle aanroepen (sidebar + dashboard) → één GET /api/platform-settings. */
let brandingInFlight = null;

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
  if (force) {
    cache = null;
    brandingInFlight = null;
  } else if (cache) {
    return cache;
  }
  if (brandingInFlight) {
    return brandingInFlight;
  }
  brandingInFlight = (async () => {
    swPerf.brandingNetworkRequests += 1;
    const res = await apiFetch("/api/platform-settings");
    if (handleAuthFailure(res)) {
      cache = defaultBranding();
      return cache;
    }
    if (!res.ok) {
      cache = defaultBranding();
      return cache;
    }
    const data = await res.json().catch(() => null);
    if (!data) {
      cache = defaultBranding();
      return cache;
    }
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
  })();
  try {
    return await brandingInFlight;
  } finally {
    brandingInFlight = null;
  }
}

export function clearPlatformBrandingCache() {
  cache = null;
  brandingInFlight = null;
}
