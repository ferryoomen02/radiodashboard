import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure, withStationQuery } from "./portal-api.js";
import { fetchActiveFeatures } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { redirectNoModuleAccess } from "./portal-routing.js";
import { getActiveStationIdForApi, setActiveStationId } from "./portal-station.js";

let auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}

let isSuper = false;
const superBar = document.getElementById("super-media-bar");
const superSelect = document.getElementById("media-station-select");
const grid = document.getElementById("media-grid");
const msg = document.getElementById("media-msg");
const alertEl = document.getElementById("media-alert");
const form = document.getElementById("form-upload");

const blobUrls = new Set();
let superMediaListLoaded = false;

function showAlert(t) {
  alertEl.hidden = false;
  alertEl.textContent = t;
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function ensureSuperStation() {
  if (!isSuper) return getActiveStationIdForApi(auth);
  superBar.hidden = false;
  if (!superMediaListLoaded) {
    superMediaListLoaded = true;
    const res = await apiFetch("/api/stations");
    if (res.ok) {
      const { stations } = await res.json();
      superSelect.innerHTML = (stations || [])
        .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
        .join("");
      let sid = getActiveStationIdForApi(auth);
      if (!sid && stations?.length) {
        sid = stations[0].id;
        setActiveStationId(sid);
      }
      if (sid && stations?.some((s) => s.id === sid)) {
        superSelect.value = sid;
      }
      superSelect.onchange = () => {
        setActiveStationId(superSelect.value);
        clearGridBlobs();
        loadLibrary();
      };
    }
  }
  return getActiveStationIdForApi(auth);
}

function clearGridBlobs() {
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls.clear();
}

async function fetchImageBlobUrl(url) {
  const res = await apiFetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  const u = URL.createObjectURL(blob);
  blobUrls.add(u);
  return u;
}

async function loadLibrary() {
  clearGridBlobs();
  grid.innerHTML = '<p class="loading-shimmer">Laden…</p>';
  const sid = await ensureSuperStation();
  if (isSuper && !sid) {
    grid.innerHTML = '<p class="empty-state">Kies een zender.</p>';
    return;
  }
  const path = withStationQuery("/api/media", sid);
  const res = await apiFetch(path);
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    grid.innerHTML = "";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  if (!items.length) {
    grid.innerHTML = '<p class="empty-state">Nog geen bestanden.</p>';
    return;
  }

  grid.innerHTML = '<div class="media-grid-inner"></div>';
  const inner = grid.querySelector(".media-grid-inner");
  inner.style.display = "grid";
  inner.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
  inner.style.gap = "1rem";

  for (const item of items) {
    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "12px";
    card.style.overflow = "hidden";
    card.style.boxShadow = "var(--shadow-card)";
    const img = document.createElement("img");
    img.alt = item.filename || "";
    img.style.width = "100%";
    img.style.height = "120px";
    img.style.objectFit = "cover";
    img.style.display = "block";
    const u = await fetchImageBlobUrl(item.url);
    img.src = u || "";
    const cap = document.createElement("div");
    cap.style.padding = "0.5rem 0.65rem";
    cap.style.fontSize = "0.75rem";
    cap.style.wordBreak = "break-word";
    cap.textContent = item.filename || item.id;
    card.appendChild(img);
    card.appendChild(cap);

    if (getAuth()?.user?.role === "SUPER_ADMIN" || getAuth()?.user?.role === "STATION_ADMIN") {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-secondary";
      del.style.width = "100%";
      del.style.borderRadius = "0";
      del.style.fontSize = "0.75rem";
      del.textContent = "Verwijderen";
      del.addEventListener("click", async () => {
        if (!confirm("Bestand verwijderen?")) return;
        const delPath = withStationQuery(`/api/media/${encodeURIComponent(item.id)}`, sid);
        const dres = await apiFetch(delPath, { method: "DELETE" });
        if (handleAuthFailure(dres)) return;
        if (!dres.ok) {
          const e = await dres.json().catch(() => ({}));
          showAlert(e.error || "Verwijderen mislukt.");
          return;
        }
        await loadLibrary();
      });
      card.appendChild(del);
    }

    inner.appendChild(card);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  alertEl.hidden = true;
  const input = document.getElementById("media-file");
  const file = input.files?.[0];
  if (!file) return;

  const sid = await ensureSuperStation();
  if (isSuper && !sid) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = "Kies een zender.";
    return;
  }

  const fd = new FormData();
  fd.append("file", file);
  if (isSuper && sid) {
    fd.append("stationId", sid);
  }

  const uploadPath = withStationQuery("/api/media/upload", sid);
  const res = await apiFetch(uploadPath, {
    method: "POST",
    body: fd,
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = data.error || "Upload mislukt.";
    return;
  }
  input.value = "";
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.textContent = "Geüpload.";
  await loadLibrary();
});

(async () => {
  await refreshAuthProfile();
  auth = getAuth();
  isSuper = isSuperAdminRole(auth?.user?.role);
  if (!isSuper) {
    const feats = await fetchActiveFeatures(true, {
      role: auth?.user?.role,
      from: "media-page",
    });
    if (!feats?.enabledKeys?.has("media")) {
      redirectNoModuleAccess("media: geen media-module");
      return;
    }
  }
  await loadLibrary();
})();
