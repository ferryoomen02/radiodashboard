import { getAuth, canAccessStations } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { fetchActiveFeatures } from "./portal-features.js";

const auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}
if (!canAccessStations(auth.user?.role)) {
  window.location.href = "/dashboard";
}

const isSuper = auth.user?.role === "SUPER_ADMIN";
const tbody = document.getElementById("stations-tbody");
const theadRow = document.getElementById("stations-thead-row");
const alertEl = document.getElementById("stations-alert");
const assignCard = document.getElementById("stations-assign-admin");
const formAssign = document.getElementById("form-assign-admin");
const assignStation = document.getElementById("assign-station");
const assignMsg = document.getElementById("assign-msg");
const superCreate = document.getElementById("stations-super-create");
const formNew = document.getElementById("form-new-station");
const newMsg = document.getElementById("new-station-msg");
const titleEl = document.getElementById("stations-page-title");

if (isSuper) {
  superCreate.hidden = false;
  assignCard.hidden = false;
  titleEl.textContent = "Zenders";
} else {
  titleEl.textContent = "Zenderinstellingen";
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function showAlert(msg) {
  alertEl.hidden = false;
  alertEl.textContent = msg;
}

function hideAlert() {
  alertEl.hidden = true;
}

const colCount = () => (isSuper ? 6 : 5);

async function loadStations() {
  hideAlert();
  tbody.innerHTML = `<tr><td colspan="${colCount()}" class="loading-shimmer">Laden…</td></tr>`;
  const res = await apiFetch("/api/stations");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    tbody.innerHTML = "";
    return;
  }
  const { stations } = await res.json();
  if (!stations?.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount()}" class="empty-state">Nog geen zenders.</td></tr>`;
    return;
  }
  tbody.innerHTML = stations
    .map(
      (s) => `
    <tr data-id="${escapeHtml(s.id)}">
      <td><input class="input-field" data-field="name" value="${escapeHtml(s.name)}" /></td>
      <td><input class="input-field" data-field="description" value="${escapeHtml(s.description || "")}" placeholder="—" /></td>
      <td>${s.userCount ?? "—"}</td>
      <td>${s.trackCount ?? "—"}</td>
      ${
        isSuper
          ? `<td><a class="btn-secondary" style="display:inline-block;text-decoration:none;padding:0.35rem 0.75rem" href="/station-features?stationId=${encodeURIComponent(s.id)}">Functies</a></td>`
          : ""
      }
      <td><button type="button" class="btn-secondary btn-save-station">Opslaan</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll(".btn-save-station").forEach((btn) => {
    btn.addEventListener("click", () => saveRow(btn.closest("tr")));
  });
}

async function saveRow(tr) {
  if (!tr) return;
  hideAlert();
  const id = tr.dataset.id;
  const name = tr.querySelector('[data-field="name"]')?.value?.trim() || "";
  const description = tr.querySelector('[data-field="description"]')?.value?.trim() || "";
  if (!name) {
    showAlert("Naam mag niet leeg zijn.");
    return;
  }
  const res = await apiFetch(`/api/stations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name, description: description || null }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showAlert(data.error || "Opslaan mislukt.");
    return;
  }
  await loadStations();
}

formNew.addEventListener("submit", async (e) => {
  e.preventDefault();
  newMsg.hidden = true;
  const name = document.getElementById("new-station-name").value.trim();
  const description = document.getElementById("new-station-desc").value.trim();
  if (!name) return;
  const res = await apiFetch("/api/stations", {
    method: "POST",
    body: JSON.stringify({ name, description: description || undefined }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    newMsg.hidden = false;
    newMsg.className = "alert alert-error";
    newMsg.textContent = data.error || "Aanmaken mislukt.";
    return;
  }
  formNew.reset();
  newMsg.hidden = false;
  newMsg.className = "alert";
  newMsg.style.background = "var(--color-accent-soft)";
  newMsg.style.color = "var(--color-accent-hover)";
  newMsg.textContent = "Zender aangemaakt.";
  await loadStations();
  await fillAssignStations();
});

async function fillAssignStations() {
  if (!isSuper || !assignStation) return;
  const res = await apiFetch("/api/stations");
  if (!res.ok) return;
  const { stations } = await res.json();
  assignStation.innerHTML = (stations || [])
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
    .join("");
}

formAssign.addEventListener("submit", async (e) => {
  e.preventDefault();
  assignMsg.hidden = true;
  const email = document.getElementById("assign-email").value.trim().toLowerCase();
  const stationId = assignStation.value;
  if (!email || !stationId) return;
  const res = await apiFetch("/api/stations/assign-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, stationId }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    assignMsg.hidden = false;
    assignMsg.className = "alert alert-error";
    assignMsg.textContent = data.error || "Koppelen mislukt.";
    return;
  }
  formAssign.reset();
  assignMsg.hidden = false;
  assignMsg.className = "alert";
  assignMsg.style.background = "var(--color-accent-soft)";
  assignMsg.textContent = data.message || "Station admin gekoppeld.";
  await fillAssignStations();
  await loadStations();
});

async function boot() {
  const feats = await fetchActiveFeatures();
  if (!feats?.enabledKeys?.has("stations")) {
    window.location.href = "/account";
    return;
  }
  if (isSuper && theadRow) {
    const lastTh = theadRow.querySelector("th:last-child");
    const th = document.createElement("th");
    th.textContent = "Functies";
    theadRow.insertBefore(th, lastTh);
  }
  await fillAssignStations();
  await loadStations();
}

boot();
