import { getAuth, clearAuth, canAccessStations, canAccessUsers, roleLabelNl } from "./portal-auth.js";
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

export function mountSidebar() {
  const root = document.getElementById("sidebar-root");
  if (!root) {
    swLog("sidebar", "mountSidebar: geen #sidebar-root (normaal op loginpagina)");
    return;
  }

  const auth = getAuth();
  if (!auth?.token) {
    swLog("sidebar", "geen token → redirect /login");
    swLogRedirect("/login", "mountSidebar zonder token");
    window.location.href = "/login";
    return;
  }

  swLog("sidebar", "mount OK", { page: document.body.dataset.page, role: auth.user?.role });
  const role = auth.user?.role;
  const current = document.body.dataset.page || "";
  const stationLine =
    role === "SUPER_ADMIN"
      ? "Alle zenders"
      : auth.station?.name || "Geen zender";

  let nav = "";
  nav += navItem("/dashboard", "Dashboard", iconDashboard, "dashboard", current);

  if (canAccessStations(role)) {
    const label = role === "SUPER_ADMIN" ? "Zenders" : "Zenderinstellingen";
    const pageKey = "stations";
    nav += navItem("/stations", label, iconStation, pageKey, current);
  }

  if (canAccessUsers(role)) {
    nav += navItem("/users", "Gebruikers", iconUsers, "users", current);
  }

  nav += navItem("/account", "Mijn account", iconAccount, "account", current);
  nav += mutedItem("Studio (binnenkort)", iconStation);

  root.innerHTML = `
    <div class="sidebar-brand">
      <div class="logo-row">
        <div class="brand-mark" aria-hidden="true">S</div>
        <div class="brand-text">
          <strong id="sidebar-brand-title">SonicWave</strong>
          <span>Platform</span>
        </div>
      </div>
      <p class="sidebar-context" id="sidebar-context-line">${escapeHtml(stationLine)}</p>
    </div>
    <nav class="nav-section" aria-label="Menu">
      <div class="nav-label">Menu · ${escapeHtml(roleLabelNl(role))}</div>
      ${nav}
    </nav>
    <div class="sidebar-footer">
      <button type="button" class="nav-item sidebar-logout" id="sidebar-logout" style="width:100%;border:none;background:transparent;text-align:left;cursor:pointer;font:inherit;">
        ${iconLogout}
        Uitloggen
      </button>
    </div>
  `;

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

function init() {
  mountSidebar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
