import { getAuth, canAccessStations, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { ensurePageSession } from "./portal-session.js";
import { redirectNoModuleAccess } from "./portal-routing.js";

let auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}

let isSuper = false;
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
const companySelect = document.getElementById("new-station-company");

function applyStationsRoleUi() {
  isSuper = auth?.user?.role === "SUPER_ADMIN";
  if (isSuper) {
    superCreate.hidden = false;
    assignCard.hidden = false;
    titleEl.textContent = "Zenders";
    theadRow.innerHTML = `
      <th>Naam</th>
      <th>Bedrijf</th>
      <th>Slug</th>
      <th>Status</th>
      <th>Omschrijving</th>
      <th>Gebr.</th>
      <th>Tracks</th>
      <th></th>
    `;
  } else {
    titleEl.textContent = "Zenderinstellingen";
    theadRow.innerHTML = `
      <th>Naam</th>
      <th>Omschrijving</th>
      <th>Gebruikers</th>
      <th>Tracks</th>
      <th></th>
    `;
  }
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

function colCount() {
  return isSuper ? 8 : 5;
}

function statusNl(s) {
  const m = { ACTIVE: "Actief", INACTIVE: "Inactief", ARCHIVED: "Gearchiveerd" };
  return m[s] || s;
}

async function loadCompaniesIntoSelect() {
  if (!companySelect) return;
  const res = await apiFetch("/api/companies");
  if (!res.ok) return;
  const data = await res.json();
  const list = data.companies || [];
  companySelect.innerHTML = list
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join("");
}

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

  if (isSuper) {
    tbody.innerHTML = stations
      .map(
        (s) => `
    <tr data-id="${escapeHtml(s.id)}">
      <td><input class="input-field" data-field="name" value="${escapeHtml(s.name)}" /></td>
      <td>${escapeHtml(s.company?.name || "—")}</td>
      <td><code style="font-size:0.8rem">${escapeHtml(s.slug || "")}</code></td>
      <td>${escapeHtml(statusNl(s.status))}</td>
      <td><input class="input-field" data-field="description" value="${escapeHtml(s.description || "")}" placeholder="—" /></td>
      <td>${s.userCount ?? "—"}</td>
      <td>${s.trackCount ?? "—"}</td>
      <td>
        <a class="btn-secondary" style="display:inline-block;text-decoration:none;padding:0.35rem 0.75rem;margin-right:0.35rem" href="/station/${encodeURIComponent(s.id)}">Beheren</a>
        <button type="button" class="btn-secondary btn-save-station">Opslaan</button>
      </td>
    </tr>
  `
      )
      .join("");
  } else {
    tbody.innerHTML = stations
      .map(
        (s) => `
    <tr data-id="${escapeHtml(s.id)}">
      <td><input class="input-field" data-field="name" value="${escapeHtml(s.name)}" /></td>
      <td><input class="input-field" data-field="description" value="${escapeHtml(s.description || "")}" placeholder="—" /></td>
      <td>${s.userCount ?? "—"}</td>
      <td>${s.trackCount ?? "—"}</td>
      <td><button type="button" class="btn-secondary btn-save-station">Opslaan</button></td>
    </tr>
  `
      )
      .join("");
  }

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
  const companyId = companySelect?.value;
  const name = document.getElementById("new-station-name").value.trim();
  let slug = document.getElementById("new-station-slug").value.trim();
  const description = document.getElementById("new-station-desc").value.trim();
  if (!companyId || !name) return;
  const body = { companyId, name, description: description || undefined };
  if (slug) body.slug = slug;
  const res = await apiFetch("/api/stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  const session = await ensurePageSession();
  auth = session.auth || getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (!canAccessStations(auth.user?.role)) {
    window.location.href = "/dashboard";
    return;
  }
  applyStationsRoleUi();

  const me = auth;
  if (!isSuperAdminRole(me?.user?.role)) {
    const feats = session.features;
    if (!feats?.enabledKeys?.has("stations")) {
      redirectNoModuleAccess("stations: geen stations-module");
      return;
    }
  }
  if (isSuper) {
    await loadCompaniesIntoSelect();
  }
  await fillAssignStations();
  await loadStations();
}

boot();
