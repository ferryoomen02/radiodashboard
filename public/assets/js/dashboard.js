import {
  getAuth,
  clearAuth,
  displayNameFromEmail,
  timeGreeting,
  formatDateNl,
} from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";

const auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}

const els = {
  stationName: document.getElementById("sidebar-station-name"),
  greeting: document.getElementById("greeting-name"),
  date: document.getElementById("header-date"),
  stationInfo: document.getElementById("station-info-body"),
  nowPlayingRoot: document.getElementById("now-playing-root"),
  historyContainer: document.getElementById("history-container"),
  userEmail: document.getElementById("user-email"),
  addForm: document.getElementById("add-track-form"),
  addError: document.getElementById("add-track-error"),
  addSuccess: document.getElementById("add-track-success"),
  logout: document.getElementById("btn-logout"),
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

async function loadDashboard() {
  els.stationName.textContent = auth.station?.name || "Radio";
  const name =
    sessionStorage.getItem("portalDisplayName") || displayNameFromEmail(auth.user?.email);
  els.greeting.textContent = `${timeGreeting()}, ${name}!`;
  els.date.textContent = formatDateNl();
  els.userEmail.textContent = auth.user?.email || "—";

  els.stationInfo.innerHTML = '<p class="loading-shimmer">Laden…</p>';
  els.nowPlayingRoot.innerHTML = '<p class="loading-shimmer">Laden…</p>';
  els.historyContainer.innerHTML = "";

  const res = await apiFetch("/radio");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    els.stationInfo.innerHTML = `<p class="empty-state">Kon data niet laden (${res.status}).</p>`;
    els.nowPlayingRoot.innerHTML = "";
    return;
  }

  const data = await res.json();
  const st = data.station;

  els.stationInfo.innerHTML = `
    <div class="station-meta">
      <p><strong>Station</strong><br />${escapeHtml(st?.name || "—")}</p>
      <p><strong>Station-ID</strong><br /><code style="font-size:0.8rem">${escapeHtml(st?.id || "—")}</code></p>
      <p><strong>Nummers in bibliotheek</strong><br />${st?.trackCount ?? 0}</p>
    </div>
  `;

  const hist = data.history || [];
  renderNowPlaying(data.nowPlaying, hist);
  renderHistory(hist);
}

els.addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.addError.hidden = true;
  els.addSuccess.hidden = true;

  const artist = document.getElementById("track-artist").value.trim();
  const title = document.getElementById("track-title").value.trim();
  const durationRaw = document.getElementById("track-duration").value.trim();

  const body = { artist, title };
  if (durationRaw !== "") {
    const n = parseInt(durationRaw, 10);
    if (Number.isFinite(n) && n >= 0) body.durationSeconds = n;
  }

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

els.logout.addEventListener("click", () => {
  clearAuth();
  sessionStorage.removeItem("portalDisplayName");
  window.location.href = "/login";
});

loadDashboard();
