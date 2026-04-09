import { getAuth, clearAuth, canAccessStations, canAccessUsers, roleLabelNl } from "./portal-auth.js";
import { SUPER_NAV_FALLBACK_KEYS } from "./portal-features.js";
import { ensurePageSession } from "./portal-session.js";
import { fetchPlatformBranding } from "./portal-branding.js";
import { SONICWAVE_DEBUG } from "./portal-debug.js";
import { swLog, swLogRedirect } from "./portal-debug.js";

function navItem(href, label, icon, page, current) {
  const active = page === current ? " is-active" : "";
  return `<a class="nav-item${active}" href="${href}" ${page === current ? 'aria-current="page"' : ""}>
    ${icon}
    ${label}
  </a>`;
}

function mutedItem(label, icon) {
  return `<span class="nav-item is-muted">${icon}${label}</span>`;
}

const iconDashboard = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`;
const iconStation = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 19.1C2.7 17 2 12 2 12s.7-5 2.9-7.1S12 2 12 2s5 .7 7.1 2.9S22 12 22 12s-.7 5-2.9 7.1S12 22 12 22s-5-.7-7.1-2.9Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const iconUsers = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const iconAccount = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const iconLogout = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const iconMail = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const iconSliders = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;
const iconMic = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const iconFile = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
const iconSettings = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const iconImage = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;

/** Voorkomt dubbele parallelle mount (zeldzaam). */
let sidebarMountInFlight = null;

function labelFor(keys, key, fallback) {
  return keys.labelByKey[key] || fallback;
}

/** Eén keer innerHTML: geen placeholder → geen dubbele paint / “flikkerend” menu. */
function sidebarShellWithNav(branding, stationLine, role, navInnerHtml) {
  const platformTitle = escapeHtml(branding.platformName || "SonicWave");
  const platformSub = escapeHtml(branding.subtitle || "Platform");
  const initial = escapeHtml((branding.platformName || "S").slice(0, 1).toUpperCase());
  const logoOrMark = branding.logoUrl
    ? `<div class="sidebar-logo-wrap"><img src="${escapeHtml(branding.logoUrl)}" alt="" class="sidebar-logo-img" loading="lazy" decoding="async" /></div>`
    : `<div class="sidebar-brand-fallback" aria-hidden="true"><span class="sidebar-brand-fallback-letter">${initial}</span></div>`;
  return `
    <div class="sidebar-brand">
      <div class="sidebar-brand-inner">
        <div class="sidebar-logo-slot">${logoOrMark}</div>
        <div class="sidebar-brand-meta">
          <strong class="sidebar-brand-name" id="sidebar-brand-title">${platformTitle}</strong>
          <span class="sidebar-brand-subtitle">${platformSub}</span>
          <span class="sidebar-brand-station" id="sidebar-context-line">${escapeHtml(stationLine)}</span>
        </div>
      </div>
    </div>
    <nav class="nav-section" aria-label="Menu">
      <div class="nav-label">Menu · ${escapeHtml(roleLabelNl(role))}</div>
      ${navInnerHtml}
    </nav>
    <div class="sidebar-footer">
      <button type="button" class="nav-item sidebar-logout" id="sidebar-logout" style="width:100%;border:none;background:transparent;text-align:left;cursor:pointer;font:inherit;">
        ${iconLogout}
        Uitloggen
      </button>
    </div>
  `;
}

export async function mountSidebar() {
  const root = document.getElementById("sidebar-root");
  if (!root) {
    swLog("sidebar", "mountSidebar: geen #sidebar-root (normaal op loginpagina)");
    return;
  }
  if (root.dataset.sidebarMounted === "1") {
    if (SONICWAVE_DEBUG) {
      console.debug("[SonicWave sidebar] mountSidebar overgeslagen (al gemount op deze pagina)");
    }
    return;
  }
  if (sidebarMountInFlight) {
    if (SONICWAVE_DEBUG) {
      console.debug("[SonicWave sidebar] mountSidebar: wacht op lopende mount");
    }
    return sidebarMountInFlight;
  }
  sidebarMountInFlight = mountSidebarBody(root);
  try {
    await sidebarMountInFlight;
  } finally {
    sidebarMountInFlight = null;
  }
}

async function mountSidebarBody(root) {
  if (typeof window !== "undefined") {
    window.__swSidebarMounts = (window.__swSidebarMounts || 0) + 1;
    if (SONICWAVE_DEBUG) {
      console.debug("[SonicWave sidebar] mountSidebarBody start", { count: window.__swSidebarMounts });
    }
  }

  let auth = getAuth();
  if (!auth?.token) {
    swLog("sidebar", "geen token → redirect /login");
    swLogRedirect("/login", "mountSidebar zonder token");
    window.location.href = "/login";
    return;
  }

  const session = await ensurePageSession();
  auth = session.auth || getAuth();
  if (!auth?.token) {
    return;
  }
  swLog("sidebar", "sessie geladen (gedeeld met pagina)", { role: auth.user?.role });

  const branding = await fetchPlatformBranding();

  const role = auth.user?.role;
  const stationLine =
    role === "SUPER_ADMIN"
      ? "Alle zenders"
      : auth.station?.name || "Geen zender";

  const feats = session.features;
  let enabled = feats?.enabledKeys ?? new Set();
  const current = document.body.dataset.page || "";

  if (role === "SUPER_ADMIN") {
    SUPER_NAV_FALLBACK_KEYS.forEach((k) => enabled.add(k));
  }

  swLog("sidebar", "mount OK", {
    page: current,
    role: auth.user?.role,
    superAdmin: role === "SUPER_ADMIN",
    navKeyCount: enabled.size,
  });
  if (SONICWAVE_DEBUG) {
    console.debug("[SonicWave sidebar] één render", { role, email: auth.user?.email, navKeyCount: enabled.size });
  }

  let nav = "";

  if (enabled.has("dashboard")) {
    nav += navItem("/dashboard", labelFor(feats, "dashboard", "Dashboard"), iconDashboard, "dashboard", current);
  }

  if (canAccessStations(role) && enabled.has("stations")) {
    const label = role === "SUPER_ADMIN" ? "Zenders" : "Zenderinstellingen";
    nav += navItem("/stations", label, iconStation, "stations", current);
  }

  if (role === "SUPER_ADMIN" && enabled.has("stations")) {
    nav += navItem(
      "/station-features",
      "Zenderfuncties",
      iconSliders,
      "station-features",
      current
    );
  }

  if (canAccessUsers(role) && enabled.has("users")) {
    nav += navItem("/users", labelFor(feats, "users", "Gebruikers"), iconUsers, "users", current);
  }

  if (role === "SUPER_ADMIN" && enabled.has("invites")) {
    nav += navItem("/invites", "Uitnodigingen", iconMail, "invites", current);
  }

  if (role === "SUPER_ADMIN" && enabled.has("platform_branding")) {
    nav += navItem(
      "/settings",
      labelFor(feats, "platform_branding", "Branding & portal"),
      iconSettings,
      "settings",
      current
    );
  }

  if (enabled.has("media")) {
    nav += navItem("/media", labelFor(feats, "media", "Media"), iconImage, "media", current);
  }

  if (enabled.has("djs")) {
    nav += navItem("/djs", labelFor(feats, "djs", "DJ's"), iconMic, "djs", current);
  }
  if (enabled.has("audiologger")) {
    nav += navItem(
      "/audiologger",
      labelFor(feats, "audiologger", "Audiologger"),
      iconMic,
      "audiologger",
      current
    );
  }
  if (enabled.has("files")) {
    nav += navItem("/files", labelFor(feats, "files", "Bestanden"), iconFile, "files", current);
  }
  if (enabled.has("site_settings")) {
    nav += navItem(
      "/site-settings",
      labelFor(feats, "site_settings", "Site-instellingen"),
      iconSettings,
      "site-settings",
      current
    );
  }

  nav += navItem("/account", "Mijn account", iconAccount, "account", current);
  nav += mutedItem("Studio (binnenkort)", iconStation);

  root.innerHTML = sidebarShellWithNav(branding, stationLine, role, nav);
  root.dataset.sidebarMounted = "1";
  root.classList.add("sidebar--ready");

  if (SONICWAVE_DEBUG) {
    const dbg = document.createElement("div");
    dbg.className = "sidebar-auth-debug";
    dbg.setAttribute("aria-label", "Auth debug");
    const u = getAuth()?.user;
    dbg.innerHTML = `<div style="font-size:10px;line-height:1.35;opacity:0.75;padding:0.5rem 1rem 0;color:rgba(255,255,255,0.65);word-break:break-word;border-top:1px solid rgba(255,255,255,0.08)"><strong style="color:rgba(255,255,255,0.9)">Debug</strong><br/>role: ${escapeHtml(String(u?.role ?? "—"))}<br/>email: ${escapeHtml(String(u?.email ?? "—"))}<br/>permissions: ${escapeHtml(JSON.stringify(u?.permissions ?? []))}</div>`;
    root.querySelector(".sidebar-footer")?.before(dbg);
  }

  root.querySelector("#sidebar-logout")?.addEventListener("click", () => {
    clearAuth();
    sessionStorage.removeItem("portalDisplayName");
    sessionStorage.removeItem("sonicwaveActiveStationId");
    swLogRedirect("/login", "uitloggen knop");
    window.location.href = "/login";
  });
}


function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function init() {
  await mountSidebar();
}

if (typeof window !== "undefined" && SONICWAVE_DEBUG) {
  window.__swSidebarModuleInits = (window.__swSidebarModuleInits || 0) + 1;
  console.debug("[SonicWave sidebar] module geladen", { count: window.__swSidebarModuleInits });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
