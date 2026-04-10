/**
 * Cache voor sidebar-menu (features + branding) binnen dezelfde browser-sessie.
 * Voorkomt dat het menu op elke pagina opnieuw "leeg" wacht tot alle netwerkcalls klaar zijn.
 * Wordt gewist bij invalidatePageSession (o.a. actieve zender gewijzigd).
 */

const MENU_SNAPSHOT_KEY = "sw_sidebar_menu_v1";

/** Volledige sidebar-HTML voor synchroon herstel bij MPA-navigatie (sessionStorage). */
export const SIDEBAR_HTML_STORAGE_KEY = "sw_sidebar_html_v1";

function snapshotFingerprint(getAuth) {
  const a = getAuth();
  if (!a?.token) return null;
  const superStation =
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem("sonicwaveActiveStationId") || "" : "";
  return `${a.token.slice(0, 24)}|${a.user?.role ?? ""}|${superStation}|${a.station?.id ?? ""}`;
}

/**
 * @returns {null | {
 *   fp: string,
 *   enabledKeys: string[],
 *   labelByKey: Record<string, string>,
 *   role: string,
 *   branding: { platformName?: string, subtitle?: string, logoUrl?: string | null },
 *   stationLine: string
 * }}
 */
export function readMenuSnapshot(getAuth) {
  try {
    const raw = sessionStorage.getItem(MENU_SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    const a = getAuth();
    if (!a?.token) return null;
    const fp = snapshotFingerprint(getAuth);
    if (!fp || snap.fp !== fp) return null;
    if (!Array.isArray(snap.enabledKeys) || !snap.role) return null;
    return snap;
  } catch {
    return null;
  }
}

/** @param session — resultaat ensurePageSession (met features); @param branding — fetchPlatformBranding */
export function writeMenuSnapshot(getAuth, session, branding) {
  try {
    const auth = getAuth();
    if (!auth?.token || !session?.features?.enabledKeys) return;
    const fp = snapshotFingerprint(getAuth);
    if (!fp) return;
    const fe = session.features;
    sessionStorage.setItem(
      MENU_SNAPSHOT_KEY,
      JSON.stringify({
        fp,
        enabledKeys: [...fe.enabledKeys],
        labelByKey: fe.labelByKey && typeof fe.labelByKey === "object" ? fe.labelByKey : {},
        role: auth.user?.role,
        branding: {
          platformName: branding?.platformName,
          subtitle: branding?.subtitle,
          logoUrl: branding?.logoUrl ?? null,
        },
        stationLine:
          auth.user?.role === "SUPER_ADMIN"
            ? "Alle zenders"
            : auth.station?.name || "Geen zender",
      })
    );
  } catch {
    /* ignore quota */
  }
}

export function clearMenuSnapshot() {
  try {
    sessionStorage.removeItem(MENU_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function clearPersistedSidebarHtml() {
  try {
    sessionStorage.removeItem(SIDEBAR_HTML_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Menu-snapshot + opgeslagen sidebar-HTML (bij logout / invalidate / zenderwissel). */
export function clearSidebarSessionCaches() {
  clearMenuSnapshot();
  clearPersistedSidebarHtml();
}

/**
 * Bewaar laatste sidebar-markup zodat de volgende pagina die synchroon kan tonen vóór module-load.
 * @param {string} innerHtml — zonder debug-blokken
 */
export function persistSidebarHtml(innerHtml) {
  try {
    if (innerHtml && innerHtml.length > 80) {
      sessionStorage.setItem(SIDEBAR_HTML_STORAGE_KEY, innerHtml);
    }
  } catch {
    /* ignore quota */
  }
}
