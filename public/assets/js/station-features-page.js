import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { redirectNoModuleAccess } from "./portal-routing.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { fetchActiveFeatures } from "./portal-features.js";

if (!getAuth()?.token) {
  window.location.href = "/login";
}

const sel = document.getElementById("sf-station");
const root = document.getElementById("sf-features");
const alertEl = document.getElementById("sf-alert");
const saveBtn = document.getElementById("sf-save");
const defTbody = document.getElementById("sf-def-tbody");
const formDef = document.getElementById("sf-new-def");
const defMsg = document.getElementById("sf-def-msg");

/** @type {{ definitions: { key: string, label: string, isBuiltIn: boolean }[], enabledKeys: string[] } | null} */
let state = null;

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function showAlert(t) {
  alertEl.hidden = false;
  alertEl.textContent = t;
}

function hideAlert() {
  alertEl.hidden = true;
}

function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

async function loadStationsList() {
  const res = await apiFetch("/api/stations");
  if (handleAuthFailure(res)) return null;
  if (!res.ok) {
    showAlert("Zenders laden mislukt.");
    return null;
  }
  const data = await res.json();
  return data.stations || [];
}

function renderFeatureCheckboxes() {
  if (!state?.definitions?.length) {
    root.innerHTML = '<p class="empty-state">Geen feature-definities geladen.</p>';
    return;
  }
  const enabled = new Set(state.enabledKeys || []);
  root.innerHTML = state.definitions
    .map((d, idx) => {
      const id = `feat-${idx}`;
      return `
      <label class="sf-check" style="display:flex;gap:0.5rem;align-items:flex-start;margin:0.35rem 0;cursor:pointer">
        <input type="checkbox" data-key="${escapeHtml(d.key)}" id="${id}" ${enabled.has(d.key) ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(d.label)}</strong>
          <span style="display:block;font-size:0.8rem;color:var(--color-text-muted)">${escapeHtml(d.key)}${
            d.isBuiltIn ? " · ingebouwd" : ""
          }</span>
        </span>
      </label>`;
    })
    .join("");
}

function renderCustomDefsTable() {
  const customs = (state?.definitions || []).filter((d) => !d.isBuiltIn);
  if (!customs.length) {
    defTbody.innerHTML = `<tr><td colspan="3" class="empty-state">Nog geen eigen features.</td></tr>`;
    return;
  }
  defTbody.innerHTML = customs
    .map(
      (d) => `
    <tr data-key="${escapeHtml(d.key)}">
      <td><code>${escapeHtml(d.key)}</code></td>
      <td>${escapeHtml(d.label)}</td>
      <td><button type="button" class="btn-secondary sf-del-def">Verwijderen</button></td>
    </tr>`
    )
    .join("");

  defTbody.querySelectorAll(".sf-del-def").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const key = tr?.dataset?.key;
      if (!key) return;
      if (!window.confirm(`Feature "${key}" verwijderen uit de catalogus (en uit alle zenders)?`)) return;
      const res = await apiFetch(`/api/feature-definitions/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (handleAuthFailure(res)) return;
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showAlert(e.error || "Verwijderen mislukt.");
        return;
      }
      await loadStationFeatures(sel.value);
    });
  });
}

async function loadStationFeatures(stationId) {
  hideAlert();
  if (!stationId) {
    state = null;
    root.innerHTML = '<p class="empty-state">Kies een zender.</p>';
    defTbody.innerHTML = "";
    return;
  }
  const res = await apiFetch(`/api/stations/${encodeURIComponent(stationId)}/features`);
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Kon functies niet laden.");
    return;
  }
  const data = await res.json();
  state = {
    definitions: data.definitions || [],
    enabledKeys: data.enabledKeys || [],
  };
  renderFeatureCheckboxes();
  renderCustomDefsTable();
}

sel.addEventListener("change", () => {
  loadStationFeatures(sel.value);
});

saveBtn.addEventListener("click", async () => {
  hideAlert();
  const stationId = sel.value;
  if (!stationId) return;
  const inputs = root.querySelectorAll("input[type=checkbox][data-key]");
  const enabledFeatureKeys = [];
  inputs.forEach((inp) => {
    if (inp.checked) enabledFeatureKeys.push(inp.getAttribute("data-key"));
  });
  const res = await apiFetch(`/api/stations/${encodeURIComponent(stationId)}/features`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabledFeatureKeys }),
  });
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Opslaan mislukt.");
    return;
  }
  await loadStationFeatures(stationId);
});

formDef.addEventListener("submit", async (e) => {
  e.preventDefault();
  defMsg.hidden = true;
  const key = document.getElementById("sf-new-key").value.trim();
  const label = document.getElementById("sf-new-label").value.trim();
  const description = document.getElementById("sf-new-desc").value.trim();
  if (!key || !label) {
    defMsg.hidden = false;
    defMsg.className = "alert alert-error";
    defMsg.textContent = "Vul key en label in.";
    return;
  }
  const res = await apiFetch("/api/feature-definitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, label, description: description || undefined }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    defMsg.hidden = false;
    defMsg.className = "alert alert-error";
    defMsg.textContent = data.error || "Toevoegen mislukt.";
    return;
  }
  formDef.reset();
  defMsg.hidden = false;
  defMsg.className = "alert";
  defMsg.style.background = "var(--color-accent-soft)";
  defMsg.textContent = "Feature toegevoegd.";
  await loadStationFeatures(sel.value);
});

(async () => {
  await refreshAuthProfile();
  const auth = getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (!isSuperAdminRole(auth.user?.role)) {
    window.location.href = "/dashboard";
    return;
  }
  const feats = await fetchActiveFeatures(true, {
    role: auth.user?.role,
    from: "station-features-page",
  });
  if (!feats?.enabledKeys?.has("stations")) {
    redirectNoModuleAccess("station-features: geen stations-module in features");
    return;
  }

  const stations = await loadStationsList();
  if (!stations?.length) {
    sel.innerHTML = `<option value="">Geen zenders — maak eerst een zender aan</option>`;
    return;
  }

  sel.innerHTML = stations.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
  const fromUrl = qs("stationId");
  if (fromUrl && stations.some((s) => s.id === fromUrl)) {
    sel.value = fromUrl;
  }
  await loadStationFeatures(sel.value);
})();
