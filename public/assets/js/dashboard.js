import {
  getAuth,
  greetingName,
  timeGreeting,
  formatDateNl,
  roleLabelNl,
} from "./portal-auth.js";
import { apiFetch, handleAuthFailure, withStationQuery } from "./portal-api.js";
import { getActiveStationIdForApi, setActiveStationId } from "./portal-station.js";
import { swLog, swLogRedirect } from "./portal-debug.js";

const bootAuth = getAuth();
if (!bootAuth?.token) {
  swLog("dashboard", "geen token bij module-load → /login");
  swLogRedirect("/login", "dashboard.js zonder token");
  window.location.href = "/login";
} else {
  swLog("dashboard", "module-load OK", {
    role: bootAuth.user?.role,
    email: bootAuth.user?.email,
    stationId: bootAuth.station?.id,
  });

  const els = {
    greeting: document.getElementById("greeting-name"),
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
            ? `<p class="now-artist" style="margin-top:0.5rem;font-size:0.85rem">Duur: ${np.durationSeconds}s</p>`
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

  async function resolveActiveStationId(a) {
    if (a.user.role !== "SUPER_ADMIN") {
      swLog("dashboard", "resolveStation: geen super", { role: a.user.role });
      els.superBar.hidden = true;
      const sid = getActiveStationIdForApi(a);
      swLog("dashboard", "resolveStation: stationId uit auth", sid || "(null)");
      return sid;
    }

    swLog("dashboard", "resolveStation: super admin → GET /api/stations");
    els.superBar.hidden = false;
    const res = await apiFetch("/api/stations");
    if (handleAuthFailure(res)) {
      swLog("dashboard", "resolveStation: afgebroken na 401");
      return null;
    }
    if (!res.ok) {
      swLog("dashboard", "resolveStation: /api/stations niet OK", res.status);
      els.superSelect.innerHTML = "";
      return null;
    }

    const { stations } = await res.json();
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
      swLog("dashboard", "actieve zender gewijzigd", els.superSelect.value);
      loadDashboard();
    };

    return sid || null;
  }

  async function loadDashboard() {
    const a = getAuth();
    if (!a?.token) {
      swLog("dashboard", "loadDashboard: token weg → /login");
      swLogRedirect("/login", "loadDashboard zonder token");
      window.location.href = "/login";
      return;
    }

    swLog("dashboard", "loadDashboard: start");
    els.greeting.textContent = `${timeGreeting()}, ${greetingName(a)}!`;
    els.date.textContent = formatDateNl();
    els.userEmail.textContent = a.user?.email || "—";
    els.userDisplayName.textContent = greetingName(a);
    els.userRolePill.textContent = roleLabelNl(a.user?.role) || "—";

    const sid = await resolveActiveStationId(a);

    if (a.user.role === "SUPER_ADMIN" && !sid) {
      swLog("dashboard", "loadDashboard: super zonder zender — stop (geen /radio)");
      els.stationInfo.innerHTML =
        '<p class="empty-state">Maak eerst een zender aan via <strong>Zenders</strong> in het menu.</p>';
      els.nowPlayingRoot.innerHTML = "";
      els.historyContainer.innerHTML = "";
      return;
    }

    els.stationInfo.innerHTML = '<p class="loading-shimmer">Laden…</p>';
    els.nowPlayingRoot.innerHTML = '<p class="loading-shimmer">Laden…</p>';
    els.historyContainer.innerHTML = "";

    const url = withStationQuery("/radio", sid);
    swLog("dashboard", "loadDashboard: GET", url);
    const res = await apiFetch(url);
    if (handleAuthFailure(res)) {
      swLog("dashboard", "loadDashboard: 401 handler heeft redirect gedaan");
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      swLog("dashboard", "loadDashboard: /radio fout", { status: res.status, err });
      els.stationInfo.innerHTML = `<p class="empty-state">${escapeHtml(err.error || "Kon data niet laden.")}</p>`;
      els.nowPlayingRoot.innerHTML = "";
      return;
    }

    const data = await res.json();
    const st = data.station;
    swLog("dashboard", "loadDashboard: data OK", { station: st?.name });

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

    const hist = data.history || [];
    renderNowPlaying(data.nowPlaying, hist);
    renderHistory(hist);
    swLog("dashboard", "loadDashboard: klaar");
  }

  els.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.addError.hidden = true;
    els.addSuccess.hidden = true;

    const a = getAuth();
    const sid = getActiveStationIdForApi(a);
    if (a.user.role === "SUPER_ADMIN" && !sid) {
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
    if (a.user.role === "SUPER_ADMIN") {
      body.stationId = sid;
    }

    swLog("dashboard", "POST /tracks", body);
    const res = await apiFetch("/tracks", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (handleAuthFailure(res)) return;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      els.addError.hidden = false;
      els.addError.textContent = data.error || "Nummer toevoegen mislukt.";
      return;
    }

    els.addSuccess.hidden = false;
    els.addSuccess.textContent = `Toegevoegd: ${data.artist} — ${data.title}`;
    els.addForm.reset();
    await loadDashboard();
  });

  loadDashboard();
}
