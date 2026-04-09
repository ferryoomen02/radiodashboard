import { getAuth } from "./portal-auth.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { fetchActiveFeatures, clearActiveFeaturesCache } from "./portal-features.js";
import { SONICWAVE_DEBUG } from "./portal-debug.js";

/** Eén gedeelde auth + features-load per volledige pageload (sidebar + pagina-scripts delen dezelfde Promise). */
let pageSessionPromise = null;
let lastSession = null;

function logSession(event, detail = {}) {
  if (!SONICWAVE_DEBUG) return;
  console.debug("[SonicWave session]", event, detail);
}

export function getPageSession() {
  return lastSession;
}

/**
 * Vergeet gecachte sessie (bijv. actieve zender gewijzigd → features opnieuw).
 */
export function invalidatePageSession(reason) {
  logSession("invalidate", { reason });
  pageSessionPromise = null;
  lastSession = null;
  clearActiveFeaturesCache();
}

/**
 * Eén keer per pageload: GET /auth/me + GET /api/active-features (tenzij al bezig/klaar).
 * @returns {Promise<{ auth: ReturnType<typeof getAuth>, features: Awaited<ReturnType<typeof fetchActiveFeatures>> }>}
 */
export async function ensurePageSession() {
  if (pageSessionPromise) {
    logSession("ensurePageSession → hergebruik bestaande promise");
    return pageSessionPromise;
  }
  if (typeof window !== "undefined" && !window.__swSessionStarts) {
    window.__swSessionStarts = 0;
  }
  if (typeof window !== "undefined") {
    window.__swSessionStarts = (window.__swSessionStarts || 0) + 1;
  }
  logSession("ensurePageSession → nieuwe keten (auth + features)");

  const run = (async () => {
    const a = await refreshAuthProfile();
    const auth = a || getAuth();
    if (!auth?.token) {
      lastSession = { auth: null, features: null };
      return lastSession;
    }
    const features = await fetchActiveFeatures(true, {
      role: auth.user?.role,
      from: "ensurePageSession",
    });
    lastSession = { auth: getAuth(), features };
    logSession("ensurePageSession → klaar", {
      role: lastSession.auth?.user?.role,
      featureKeys: features?.enabledKeys?.size ?? 0,
    });
    return lastSession;
  })();

  pageSessionPromise = run.catch((err) => {
    pageSessionPromise = null;
    lastSession = null;
    logSession("ensurePageSession → fout", { message: String(err?.message || err) });
    throw err;
  });

  return pageSessionPromise;
}
