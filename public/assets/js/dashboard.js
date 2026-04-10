import {
  getAuth,
  setAuth,
  greetingName,
  timeGreeting,
  formatDateNl,
  roleLabelNl,
  isSuperAdminRole,
} from "./portal-auth.js";
import { apiFetch, handleAuthFailure, withStationQuery } from "./portal-api.js";
import { ensurePageSession, invalidatePageSession } from "./portal-session.js";
import { fetchPlatformBranding } from "./portal-branding.js";
import { getActiveStationIdForApi, setActiveStationId } from "./portal-station.js";
import { swLog, swLogRedirect, SONICWAVE_DEBUG } from "./portal-debug.js";
import { redirectNoModuleAccess, logAuthRouting } from "./portal-routing.js";

const bootAuth = getAuth();
if (!bootAuth?.token) {
  swLog("dashboard", "geen token bij module-load → /login");
  swLogRedirect("/login", "dashboard.js zonder token");
  window.location.href = "/login";
} else {
  if (typeof window !== "undefined" && SONICWAVE_DEBUG) {
    window.__swDashboardModuleInits = (window.__swDashboardModuleInits || 0) + 1;
    console.debug("[SonicWave dashboard] module init", { count: window.__swDashboardModuleInits });
  }
  /** Leest body één keer; voorkomt vastlopen als de server HTML of gebroken JSON terugstuurt. */
  async function parseResponseJson(res) {
    const raw = await res.text();
    if (!raw) return { ok: true, data: {}, raw: "" };
    try {
      return { ok: true, data: JSON.parse(raw), raw };
    } catch (e) {
      console.error("[SonicWave debug] JSON parse mislukt", e, raw.slice(0, 300));
      return { ok: false, data: null, raw, error: e };
    }
  }

  function showDashboardError(title, detail) {
    const html = `<div class="alert alert-error" role="alert"><strong>${escapeHtml(title)}</strong><br/>${escapeHtml(detail || "Onbekende fout")}</div>`;
    els.stationInfo.innerHTML = html;
    els.nowPlayingRoot.innerHTML = '<p class="empty-state">Geen live-data geladen.</p>';
    els.historyContainer.innerHTML = "";
  }

  const els = {
    greeting: document.getElementById("greeting-name"),
    headerBadge: document.getElementById("header-badge"),
    headerContextBadge: document.getElementById("header-context-badge"),
    headerWelcomeText: document.getElementById("header-welcome-text"),
    date: document.getElementById("header-date"),
    superBar: document.getElementById("super-station-bar"),
    superSelect: document.getElementById("active-station-select"),
    stationInfo: document.getElementById("station-info-body"),
    nowPlayingRoot: document.getElementById("now-playing-root"),
    historyContainer: document.getElementById("history-container"),
    userEmail: document.getElementById("user-email"),
    userDisplayName: document.getElementById("user-display-name"),
    userRolePill: document.getElementById("user-role-pill"),
    addForm: document.getElementById("add-track-form"),
    addError: document.getElementById("add-track-error"),
    addSuccess: document.getElementById("add-track-success"),
    addTrackSection: document.getElementById("add-track-form")?.closest("section") ?? null,
  };

  function formatPlayedAt(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("nl-NL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function updateHeaderContextBadge(auth, stationNameOverride) {
    if (!els.headerContextBadge) return;
    let text = stationNameOverride;
    if (text == null || text === "") {
      const role = auth?.user?.role;
      if (role === "SUPER_ADMIN") {
        const opt = els.superSelect?.selectedOptions?.[0];
        text = (opt?.textContent || "").trim() || roleLabelNl(role) || "";
      } else {
        text = auth?.station?.name || roleLabelNl(role) || "";
      }
    }
    if (!text) {
      els.headerContextBadge.hidden = true;
      els.headerContextBadge.textContent = "";
      return;
    }
    els.headerContextBadge.textContent = text;
    els.headerContextBadge.hidden = false;
  }

  function skeletonNowPlaying() {
    return `<div class="skeleton-now" aria-hidden="true">
      <div class="skeleton-block"></div>
      <div class="skeleton-now-lines">
        <div class="skeleton-line skeleton-line--md"></div>
        <div class="skeleton-line skeleton-line--lg"></div>
        <div class="skeleton-line skeleton-line--sm"></div>
      </div>
    </div>`;
  }

  function skeletonStationBlock() {
    return `<div class="skeleton-stack" aria-hidden="true">
      <div class="skeleton-line skeleton-line--sm"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
    </div>`;
  }

  function skeletonHistoryBlock() {
    return `<div class="skeleton-stack" aria-hidden="true">
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
    </div>`;
  }

  function renderNowPlaying(np, hist) {
    const historyHint =
      hist?.length > 0
        ? `<div class="now-next"><span class="now-next-label">Laatst in geschiedenis</span><p>${escapeHtml(hist[0].track?.artist || "")} — ${escapeHtml(hist[0].track?.title || "")}</p></div>`
        : `<div class="now-next"><span class="now-next-label">Geschiedenis</span><p class="empty-state" style="margin:0">Nog geen eerdere nummers op dit station.</p></div>`;

    if (!np) {
      els.nowPlayingRoot.innerHTML = `
      <p class="empty-state">Er speelt nu niets. Voeg een nummer toe om de uitzending te starten.</p>
      ${historyHint}
    `;
      return;
    }

    els.nowPlayingRoot.innerHTML = `
    <div class="now-wrap">
      <div class="now-art" aria-hidden="true"></div>
      <div class="now-body">
        <div class="now-live">Live on air</div>
        <h3 class="now-title">${escapeHtml(np.title)}</h3>
        <p class="now-artist">${escapeHtml(np.artist)}</p>
        ${
          np.durationSeconds != null
            ? `<p class="now-meta">Duur: ${np.durationSeconds}s</p>`
            : ""
        }
      </div>
    </div>
    ${historyHint}
  `;
  }

  function renderHistory(hist) {
    if (!hist?.length) {
      els.historyContainer.innerHTML = '<p class="empty-state">Nog geen geschiedenis.</p>';
      return;
    }
    els.historyContainer.innerHTML = `<ul class="history-list">${hist
      .map(
        (h) => `
      <li>
        <span class="history-track">${escapeHtml(h.track?.artist || "")} — ${escapeHtml(h.track?.title || "")}</span>
        <span class="history-time">${formatPlayedAt(h.playedAt)}</span>
      </li>
    `
      )
      .join("")}</ul>`;
  }

  /**
   * Synchroniseert user + station uit de API naar localStorage.
   * Voorkomt dat een oude portalAuth (zonder role) de verkeerde tak kiest.
   */
  async function syncUserFromServer(token) {
    const res = await apiFetch("/auth/me");
    console.log("[SonicWave debug] GET /auth/me status:", res.status);
    const parsed = await parseResponseJson(res);
    console.log("[SonicWave debug] GET /auth/me body:", parsed.ok ? parsed.data : parsed.raw?.slice(0, 400));

    if (handleAuthFailure(res)) {
      return null;
    }
    if (!res.ok) {
      showDashboardError("Profiel ophalen", `HTTP ${res.status}`);
      return null;
    }
    if (!parsed.ok || !parsed.data?.user) {
      showDashboardError(
        "Profiel ophalen",
        "Server stuurde geen geldige JSON of mist `user`. Controleer of je op dezelfde host/port zit als de API."
      );
      return null;
    }

    setAuth({
      token,
      user: parsed.data.user,
      station: parsed.data.station ?? null,
    });
    const fresh = getAuth();
    console.log("[SonicWave debug] localStorage bijgewerkt, role:", fresh?.user?.role, "station:", fresh?.station?.id);
    return fresh;
  }

  async function resolveActiveStationId(a) {
    const role = a.user?.role;
    if (role !== "SUPER_ADMIN") {
      swLog("dashboard", "resolveStation: geen super", { role });
      els.superBar.hidden = true;
      const sid = getActiveStationIdForApi(a);
      swLog("dashboard", "resolveStation: stationId uit auth", sid || "(null)");
      return sid;
    }

    swLog("dashboard", "resolveStation: super admin → GET /api/stations");
    els.superBar.hidden = false;
    const res = await apiFetch("/api/stations");
    console.log("[SonicWave debug] GET /api/stations status:", res.status);
    const stationsParsed = await parseResponseJson(res);
    console.log("[SonicWave debug] GET /api/stations body:", stationsParsed.ok ? stationsParsed.data : stationsParsed.raw?.slice(0, 400));

    if (handleAuthFailure(res)) {
      swLog("dashboard", "resolveStation: afgebroken na 401");
      return null;
    }
    if (!res.ok) {
      const errMsg = stationsParsed.ok ? stationsParsed.data?.error : "Ongeldig antwoord";
      showDashboardError("Zenders laden", errMsg || `HTTP ${res.status}`);
      els.superSelect.innerHTML = "";
      return null;
    }
    if (!stationsParsed.ok) {
      showDashboardError("Zenders laden", "Antwoord is geen geldige JSON.");
      return null;
    }

    const { stations } = stationsParsed.data;
    swLog("dashboard", "resolveStation: stations geladen", (stations || []).length);
    els.superSelect.innerHTML = (stations || [])
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      )
      .join("");

    let sid = getActiveStationIdForApi(a);
    if (!sid && stations?.length) {
      sid = stations[0].id;
      setActiveStationId(sid);
      swLog("dashboard", "resolveStation: eerste zender gekozen als default", sid);
    }
    if (sid && stations?.some((s) => s.id === sid)) {
      els.superSelect.value = sid;
    }

    els.superSelect.onchange = () => {
      setActiveStationId(els.superSelect.value);
      invalidatePageSession("actieve zender gewijzigd");
      swLog("dashboard", "actieve zender gewijzigd", els.superSelect.value);
      updateHeaderContextBadge(getAuth());
      loadDashboard();
    };

    return sid || null;
  }

  async function loadDashboard() {
    try {
      if (typeof window !== "undefined") {
        window.__swDashboardLoads = (window.__swDashboardLoads || 0) + 1;
        if (window.__swDashboardLoads === 1) {
          document.body.classList.add("dashboard--hydrating");
        }
      }

      const raw = getAuth();

      if (!raw?.token) {
        swLog("dashboard", "loadDashboard: token weg → /login");
        swLogRedirect("/login", "loadDashboard zonder token");
        window.location.href = "/login";
        return;
      }

      let session = await ensurePageSession();
      let a = session.auth;
      if (!a?.token) {
        a = await syncUserFromServer(raw.token);
        if (!a) {
          return;
        }
        invalidatePageSession("dashboard syncUserFromServer");
        session = await ensurePageSession();
        a = session.auth;
      }
      if (!a?.token) {
        return;
      }

      const featState = session.features;
      if (!isSuperAdminRole(a.user?.role)) {
        if (featState && !featState.enabledKeys.has("dashboard")) {
          logAuthRouting("geen dashboard-feature (niet-super)", {
            enabledKeys: [...(featState.enabledKeys || [])],
            chosenRedirect: "/dashboard",
          });
          redirectNoModuleAccess("dashboard: station/permissies hebben geen dashboard-module");
          return;
        }
      }

      const branding = await fetchPlatformBranding();
      if (els.headerBadge) {
        els.headerBadge.textContent = branding.platformName || "SonicWave";
      }

      const customTitle = (branding.texts?.dashboardWelcomeTitle || "").trim();
      const customBody = (branding.texts?.dashboardWelcomeText || "").trim();
      if (customTitle) {
        els.greeting.textContent = customTitle;
      } else {
        els.greeting.textContent = `${timeGreeting()}, ${greetingName(a)}!`;
      }
      if (els.headerWelcomeText) {
        if (customBody) {
          els.headerWelcomeText.textContent = customBody;
          els.headerWelcomeText.hidden = false;
        } else {
          els.headerWelcomeText.textContent = "";
          els.headerWelcomeText.hidden = true;
        }
      }
      els.date.textContent = formatDateNl();
      els.userEmail.textContent = a.user?.email || "—";
      els.userDisplayName.textContent = greetingName(a);
      els.userRolePill.textContent = roleLabelNl(a.user?.role) || "—";
      updateHeaderContextBadge(a);

      const sid = await resolveActiveStationId(a);
      updateHeaderContextBadge(getAuth());
      /** resolveActiveStationId kan showDashboardError hebben getoond (bijv. /api/stations mislukt) */
      if (els.stationInfo.querySelector(".alert-error")) {
        return;
      }

      if (a.user?.role === "SUPER_ADMIN" && !sid) {
        swLog("dashboard", "loadDashboard: super zonder zender — stop (geen /radio)");
        els.stationInfo.innerHTML =
          '<p class="empty-state">Maak eerst een zender aan via <strong>Zenders</strong> in het menu.</p>';
        els.nowPlayingRoot.innerHTML = "";
        els.historyContainer.innerHTML = "";
        return;
      }

      els.stationInfo.innerHTML = skeletonStationBlock();
      els.nowPlayingRoot.innerHTML = skeletonNowPlaying();
      els.historyContainer.innerHTML = skeletonHistoryBlock();

      const url = withStationQuery("/radio", sid);
      swLog("dashboard", "loadDashboard: GET", url);

      const res = await apiFetch(url);
      console.log("[SonicWave debug] GET /radio status:", res.status);

      const radioParsed = await parseResponseJson(res);
      console.log("[SonicWave debug] GET /radio body:", radioParsed.ok ? radioParsed.data : radioParsed.raw?.slice(0, 600));

      if (handleAuthFailure(res)) {
        swLog("dashboard", "loadDashboard: 401 → redirect login");
        return;
      }

      if (!res.ok) {
        const errMsg = radioParsed.ok
          ? radioParsed.data?.error || `HTTP ${res.status}`
          : "Server stuurde geen geldige JSON (vaak HTML van een proxy of 404-pagina).";
        showDashboardError("Radio-data", errMsg);
        return;
      }

      if (!radioParsed.ok) {
        showDashboardError(
          "Radio-data",
          "Kon het antwoord niet als JSON lezen. Controleer in Network of `/radio` JSON teruggeeft."
        );
        return;
      }

      const data = radioParsed.data;
      if (!data || typeof data.station !== "object" || data.station === null) {
        showDashboardError(
          "Radio-data",
          "Antwoord mist een geldig `station`-object. Controleer de API."
        );
        return;
      }

      const st = data.station;
      swLog("dashboard", "loadDashboard: data OK", { station: st?.name });

      updateHeaderContextBadge(a, st?.name);

      els.stationInfo.innerHTML = `
    <div class="station-meta">
      <p><strong>Station</strong><br />${escapeHtml(st?.name || "—")}</p>
      <p><strong>Station-ID</strong><br /><code style="font-size:0.8rem">${escapeHtml(st?.id || "—")}</code></p>
      <p><strong>Nummers in bibliotheek</strong><br />${st?.trackCount ?? 0}</p>
      ${
        st?.description
          ? `<p><strong>Omschrijving</strong><br />${escapeHtml(st.description)}</p>`
          : ""
      }
    </div>
  `;

      const hist = Array.isArray(data.history) ? data.history : [];
      renderNowPlaying(data.nowPlaying ?? null, hist);
      renderHistory(hist);
      if (els.addTrackSection && featState) {
        els.addTrackSection.hidden = !featState.enabledKeys.has("tracks");
      }
      swLog("dashboard", "loadDashboard: klaar");
    } catch (err) {
      console.error("[SonicWave debug] loadDashboard exception:", err);
      showDashboardError(
        "Fout in dashboard",
        err?.message || String(err)
      );
    } finally {
      if (typeof document !== "undefined") {
        document.body.classList.remove("dashboard--hydrating");
      }
    }
  }

  els.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.addError.hidden = true;
    els.addSuccess.hidden = true;

    const a = getAuth();
    const sid = getActiveStationIdForApi(a);
    if (a.user?.role === "SUPER_ADMIN" && !sid) {
      els.addError.hidden = false;
      els.addError.textContent = "Kies eerst een actieve zender.";
      return;
    }

    const artist = document.getElementById("track-artist").value.trim();
    const title = document.getElementById("track-title").value.trim();
    const durationRaw = document.getElementById("track-duration").value.trim();

    const body = { artist, title };
    if (durationRaw !== "") {
      const n = parseInt(durationRaw, 10);
      if (Number.isFinite(n) && n >= 0) body.durationSeconds = n;
    }
    if (a.user?.role === "SUPER_ADMIN") {
      body.stationId = sid;
    }

    swLog("dashboard", "POST /tracks", body);
    try {
      const res = await apiFetch("/tracks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (handleAuthFailure(res)) return;

      const parsed = await parseResponseJson(res);
      if (!res.ok) {
        els.addError.hidden = false;
        els.addError.textContent = parsed.ok
          ? parsed.data?.error || `HTTP ${res.status}`
          : "Ongeldig antwoord van server.";
        return;
      }

      const data = parsed.ok ? parsed.data : {};
      els.addSuccess.hidden = false;
      els.addSuccess.textContent = `Toegevoegd: ${data.artist} — ${data.title}`;
      els.addForm.reset();
      await loadDashboard();
    } catch (err) {
      console.error("[SonicWave debug] POST /tracks", err);
      els.addError.hidden = false;
      els.addError.textContent = err?.message || "Netwerkfout.";
    }
  });

  loadDashboard();
}
