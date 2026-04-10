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

const editDialog = document.getElementById("station-edit-dialog");
const formEdit = document.getElementById("form-edit-station");
const esId = document.getElementById("es-id");
const esName = document.getElementById("es-name");
const esDesc = document.getElementById("es-desc");
const esCompany = document.getElementById("es-company");
const esStatus = document.getElementById("es-status");
const esFeatures = document.getElementById("es-features");
const esAdmins = document.getElementById("es-admins");
const esMsg = document.getElementById("es-msg");
const esSlugHint = document.getElementById("es-slug-hint");
const esCancel = document.getElementById("es-cancel");

const deleteDialog = document.getElementById("station-delete-dialog");
const deleteBody = document.getElementById("station-delete-body");
const deleteConfirm = document.getElementById("station-delete-confirm");
const deleteCancel = document.getElementById("station-delete-cancel");
let pendingDeleteId = null;
let pendingDeleteName = "";

/** @type {{ key: string, label: string, description?: string|null }[]} */
let editDefinitions = [];

function applyStationsRoleUi() {
  isSuper = auth?.user?.role === "SUPER_ADMIN";
  if (isSuper) {
    superCreate.hidden = false;
    assignCard.hidden = false;
    titleEl.textContent = "Zenders";
    theadRow.innerHTML = `
      <th>Naam</th>
      <th>Bedrijf</th>
      <th>Status</th>
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
  return isSuper ? 6 : 5;
}

function statusNl(s) {
  const m = { ACTIVE: "Actief", INACTIVE: "Inactief", ARCHIVED: "Gearchiveerd" };
  return m[s] || s;
}

async function loadCompaniesIntoSelect(selectEl) {
  const res = await apiFetch("/api/companies");
  if (!res.ok) return;
  const data = await res.json();
  const list = data.companies || [];
  selectEl.innerHTML = list
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
      .map((s) => {
        const canDel = (s.userCount ?? 0) === 0;
        const delTitle = canDel
          ? "Zender permanent verwijderen"
          : "Verwijderen niet mogelijk: er zijn nog gebruikers gekoppeld";
        return `
    <tr data-id="${escapeHtml(s.id)}">
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.company?.name || "—")}</td>
      <td>${escapeHtml(statusNl(s.status))}</td>
      <td>${s.userCount ?? "—"}</td>
      <td>${s.trackCount ?? "—"}</td>
      <td>
        <button type="button" class="btn-secondary btn-open-edit" data-id="${escapeHtml(s.id)}" style="padding:0.35rem 0.75rem;margin-right:0.35rem">Bewerken</button>
        <button type="button" class="btn-danger btn-open-del" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-users="${s.userCount ?? 0}"
          ${canDel ? "" : "disabled"} title="${escapeHtml(delTitle)}" style="padding:0.35rem 0.75rem">Verwijderen</button>
      </td>
    </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-open-edit").forEach((btn) => {
      btn.addEventListener("click", () => openEditDialog(btn.getAttribute("data-id")));
    });
    tbody.querySelectorAll(".btn-open-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        const users = parseInt(btn.getAttribute("data-users") || "0", 10);
        if (users > 0) return;
        openDeleteDialog(id, name);
      });
    });
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

    tbody.querySelectorAll(".btn-save-station").forEach((btn) => {
      btn.addEventListener("click", () => saveRow(btn.closest("tr")));
    });
  }
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

function renderFeatureToggles(definitions, enabledKeys) {
  const set = new Set(enabledKeys || []);
  esFeatures.innerHTML = definitions
    .map((d) => {
      const on = set.has(d.key);
      return `
      <label class="feature-toggle-item">
        <input type="checkbox" data-fk="${escapeHtml(d.key)}" ${on ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(d.label || d.key)}</strong>
          <small>${escapeHtml(d.description || "")}</small>
        </span>
      </label>`;
    })
    .join("");
}

async function openEditDialog(stationId) {
  esMsg.hidden = true;
  const [r1, r2] = await Promise.all([
    apiFetch(`/api/stations/${encodeURIComponent(stationId)}`),
    apiFetch(`/api/stations/${encodeURIComponent(stationId)}/features`),
  ]);
  if (handleAuthFailure(r1) || handleAuthFailure(r2)) return;
  if (!r1.ok || !r2.ok) {
    alert("Kon zender niet laden.");
    return;
  }
  const st = await r1.json();
  const feat = await r2.json();
  editDefinitions = feat.definitions || [];

  esId.value = st.id;
  esName.value = st.name || "";
  esDesc.value = st.description || "";
  esStatus.value = st.status || "ACTIVE";
  await loadCompaniesIntoSelect(esCompany);
  esCompany.value = st.companyId || "";

  esSlugHint.textContent = `Interne URL-slug (automatisch): ${st.slug || "—"} — wordt bijgewerkt als je de naam wijzigt.`;

  renderFeatureToggles(editDefinitions, feat.enabledKeys || []);

  const admins = st.stationAdmins || [];
  if (admins.length) {
    esAdmins.innerHTML = admins.map((a) => `<li>${escapeHtml(a.name)} — ${escapeHtml(a.email)}</li>`).join("");
  } else {
    esAdmins.innerHTML = '<li class="empty-state" style="list-style:none;margin:0">Geen station admin gekoppeld. Gebruik hierboven “Station admin koppelen”.</li>';
  }

  editDialog.showModal();
}

formEdit.addEventListener("submit", async (e) => {
  e.preventDefault();
  esMsg.hidden = true;
  const id = esId.value;
  const enabledFeatureKeys = Array.from(esFeatures.querySelectorAll("input[data-fk]:checked")).map((el) =>
    el.getAttribute("data-fk")
  );
  const body = {
    name: esName.value.trim(),
    description: esDesc.value.trim() || null,
    companyId: esCompany.value,
    status: esStatus.value,
    enabledFeatures: enabledFeatureKeys,
  };
  const res = await apiFetch(`/api/stations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    esMsg.hidden = false;
    esMsg.className = "alert alert-error";
    esMsg.textContent = data.error || "Opslaan mislukt.";
    return;
  }
  esMsg.hidden = false;
  esMsg.className = "alert";
  esMsg.style.background = "var(--color-accent-soft)";
  esMsg.textContent = "Opgeslagen.";
  await loadStations();
  editDialog.close();
});

esCancel.addEventListener("click", () => editDialog.close());

function openDeleteDialog(id, name) {
  pendingDeleteId = id;
  pendingDeleteName = name;
  deleteBody.innerHTML = `Je staat op het punt <strong>${escapeHtml(name)}</strong> permanent te verwijderen. Tracks en geschiedenis op deze zender worden mee opgeruimd. Dit kan niet ongedaan worden gemaakt.`;
  deleteDialog.showModal();
}

deleteCancel.addEventListener("click", () => deleteDialog.close());

deleteConfirm.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const res = await apiFetch(`/api/stations/${encodeURIComponent(pendingDeleteId)}`, { method: "DELETE" });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || "Verwijderen mislukt.");
    return;
  }
  deleteDialog.close();
  pendingDeleteId = null;
  await loadStations();
  await fillAssignStations();
});

formNew.addEventListener("submit", async (e) => {
  e.preventDefault();
  newMsg.hidden = true;
  const companyId = companySelect?.value;
  const name = document.getElementById("new-station-name").value.trim();
  const description = document.getElementById("new-station-desc").value.trim();
  if (!companyId || !name) return;
  const res = await apiFetch("/api/stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      name,
      description: description || undefined,
    }),
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

  if (!isSuperAdminRole(auth.user?.role)) {
    const feats = session.features;
    if (!feats?.enabledKeys?.has("stations")) {
      redirectNoModuleAccess("stations: geen stations-module");
      return;
    }
  }
  if (isSuper) {
    await loadCompaniesIntoSelect(companySelect);
    await loadCompaniesIntoSelect(esCompany);
  }
  await fillAssignStations();
  await loadStations();
}

boot();
