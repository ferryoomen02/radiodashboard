import { getAuth, clearAuth, greetingName } from "./portal-auth.js";

function applyBranding(station, root) {
  if (!station) return;
  root.style.setProperty("--sp-primary", station.primaryColor || "#1e293b");
  root.style.setProperty("--sp-accent", station.accentColor || "#da2e20");
  document.title = `Dashboard — ${station.name}`;

  const title = document.getElementById("sd-title");
  if (title) title.textContent = station.name;

  const logo = document.getElementById("sd-logo");
  if (station.logoUrl && logo) {
    logo.src = station.logoUrl;
    logo.alt = station.name;
    logo.hidden = false;
  }
}

(async () => {
  const root = document.getElementById("sd-root");
  const errBox = document.getElementById("sd-error");
  const errMsg = document.getElementById("sd-error-msg");
  const content = document.getElementById("sd-content");

  const pubRes = await fetch("/api/public/station");
  const pub = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok || pub.mode !== "station" || !pub.station) {
    window.location.replace("/login");
    return;
  }
  const station = pub.station;
  applyBranding(station, root);

  const auth = getAuth();
  if (!auth?.token) {
    window.location.replace("/login");
    return;
  }

  const meRes = await fetch("/auth/me", {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (meRes.status === 401) {
    clearAuth();
    window.location.replace("/login");
    return;
  }
  const me = await meRes.json().catch(() => ({}));
  const role = me.user?.role;
  const userStationId = me.station?.id ?? null;

  const isSuper = role === "SUPER_ADMIN";
  if (!isSuper && userStationId !== station.id) {
    errBox.hidden = false;
    content.hidden = true;
    errMsg.textContent =
      "Je bent ingelogd, maar dit account hoort bij een andere zender. Log uit en gebruik het juiste subdomein, of vraag een beheerder om hulp.";
    document.getElementById("sd-logout")?.addEventListener("click", () => {
      clearAuth();
      window.location.href = "/login";
    });
    return;
  }

  const greet = document.getElementById("sd-greeting");
  if (greet) {
    greet.textContent = `Welkom, ${greetingName({ user: me.user })}`;
  }

  const featHint = document.getElementById("sd-features-hint");
  if (featHint && Array.isArray(station.enabledFeatures)) {
    featHint.textContent =
      station.enabledFeatures.length > 0
        ? `Ingeschakelde modules op deze zender: ${station.enabledFeatures.join(", ")}.`
        : "Er zijn nog geen modules geconfigureerd voor deze zender.";
  }

  if (isSuper) {
    const banner = document.getElementById("sd-super-banner");
    const link = document.getElementById("sd-central-link");
    const central = pub.links?.centralPortalUrl;
    if (banner && link) {
      banner.hidden = false;
      if (central) {
        link.href = central.replace(/\/$/, "") + "/dashboard";
        link.textContent = "Open centraal portaal";
      } else {
        link.href = "#";
        link.textContent = "Centrale URL niet geconfigureerd (CENTRAL_PORTAL_URL)";
        link.style.opacity = "0.7";
        link.addEventListener("click", (e) => e.preventDefault());
      }
    }
  }

  document.getElementById("sd-logout")?.addEventListener("click", () => {
    clearAuth();
    try {
      sessionStorage.removeItem("portalDisplayName");
      sessionStorage.removeItem("sonicwaveActiveStationId");
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  });
})();
