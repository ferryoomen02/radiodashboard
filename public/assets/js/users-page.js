import { getAuth, canAccessUsers, roleLabelNl, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { fetchActiveFeatures } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";

let auth = null;
let isSuper = false;
let isStationAdminUser = false;

if (!getAuth()?.token) {
  window.location.href = "/login";
}

/** Opties voor staff-rechten (geen super-only modules). */
const PERM_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tracks", label: "Tracks & playlist" },
  { key: "media", label: "Media" },
  { key: "users", label: "Gebruikers" },
  { key: "files", label: "Bestanden" },
  { key: "djs", label: "DJ's" },
  { key: "audiologger", label: "Audiologger" },
  { key: "site_settings", label: "Site-instellingen" },
];

const tbody = document.getElementById("users-tbody");
const alertEl = document.getElementById("users-alert");
const roleWrap = document.getElementById("nu-role-wrap");
const stationWrap = document.getElementById("nu-station-wrap");
const permsWrap = document.getElementById("nu-perms-wrap");
const permsGrid = document.getElementById("nu-perms-grid");
const hintSa = document.getElementById("nu-hint-station-admin");
const form = document.getElementById("form-new-user");
const msg = document.getElementById("nu-msg");
const selRole = document.getElementById("nu-role");
const selStation = document.getElementById("nu-station");

const editDialog = document.getElementById("edit-perm-dialog");
const editForm = document.getElementById("edit-perm-form");
const editPermGrid = document.getElementById("edit-perm-grid");
const editPermEmail = document.getElementById("edit-perm-email");

let editingUserId = null;
let lastUsers = [];

function applyRoleUi() {
  if (isSuper) {
    roleWrap.hidden = false;
    stationWrap.hidden = false;
    hintSa.hidden = true;
  } else {
    roleWrap.hidden = true;
    stationWrap.hidden = true;
    hintSa.hidden = false;
  }
}

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

function renderPermCheckboxes(container, namePrefix, selected = []) {
  const set = new Set(selected);
  container.innerHTML = PERM_OPTIONS.map(
    (p) => `
    <label>
      <input type="checkbox" name="${namePrefix}" value="${escapeHtml(p.key)}" ${set.has(p.key) ? "checked" : ""} />
      ${escapeHtml(p.label)}
    </label>
  `
  ).join("");
}

function getCheckedPermissions(container, namePrefix) {
  return Array.from(container.querySelectorAll(`input[name="${namePrefix}"]:checked`)).map((el) => el.value);
}

function toggleStationField() {
  if (!isSuper) return;
  const r = selRole.value;
  const needStation = r === "STATION_ADMIN" || r === "STAFF";
  stationWrap.hidden = !needStation;
  permsWrap.hidden = r !== "STAFF";
}

function togglePermsForStationAdmin() {
  if (isStationAdminUser) {
    permsWrap.hidden = false;
  }
}

selRole.addEventListener("change", toggleStationField);

async function loadStationsForSelect() {
  if (!isSuper) return;
  const res = await apiFetch("/api/stations");
  if (!res.ok) return;
  const { stations } = await res.json();
  selStation.innerHTML = (stations || [])
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
    .join("");
  toggleStationField();
}

async function loadUsers() {
  hideAlert();
  tbody.innerHTML = `<tr><td colspan="6" class="loading-shimmer">Laden…</td></tr>`;
  const res = await apiFetch("/api/users");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    tbody.innerHTML = "";
    return;
  }
  const { users } = await res.json();
  lastUsers = users || [];
  if (!users?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nog geen gebruikers.</td></tr>`;
    return;
  }
  tbody.innerHTML = users
    .map((u) => {
      const perms = Array.isArray(u.permissions) ? u.permissions.join(", ") || "—" : "—";
      const canEdit =
        u.role === "STAFF" &&
        (isSuper || (isStationAdminUser && u.station?.id === getAuth()?.station?.id));
      return `
    <tr data-id="${escapeHtml(u.id)}" data-role="${escapeHtml(u.role)}">
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="role-pill">${escapeHtml(roleLabelNl(u.role))}</span></td>
      <td>${u.station ? escapeHtml(u.station.name) : "—"}</td>
      <td style="font-size:0.8rem;max-width:12rem;word-break:break-word">${escapeHtml(perms)}</td>
      <td>${
        canEdit
          ? `<button type="button" class="btn-secondary btn-edit-perm" data-id="${escapeHtml(u.id)}">Rechten</button>`
          : "—"
      }</td>
    </tr>
  `;
    })
    .join("");

  tbody.querySelectorAll(".btn-edit-perm").forEach((btn) => {
    btn.addEventListener("click", () => openEditDialog(btn.getAttribute("data-id")));
  });
}

function openEditDialog(userId) {
  const u = lastUsers.find((x) => x.id === userId);
  if (!u || u.role !== "STAFF") return;
  editingUserId = userId;
  editPermEmail.textContent = u.email;
  renderPermCheckboxes(editPermGrid, "edit-perm", Array.isArray(u.permissions) ? u.permissions : []);
  editDialog.showModal();
}

document.getElementById("edit-perm-cancel")?.addEventListener("click", () => editDialog.close());

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingUserId) return;
  const permissions = getCheckedPermissions(editPermGrid, "edit-perm");
  if (permissions.length === 0) {
    alert("Kies minimaal één recht.");
    return;
  }
  const res = await apiFetch(`/api/users/${encodeURIComponent(editingUserId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || "Opslaan mislukt.");
    return;
  }
  editDialog.close();
  await loadUsers();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const name = document.getElementById("nu-name").value.trim();
  const email = document.getElementById("nu-email").value.trim().toLowerCase();
  const password = document.getElementById("nu-password").value;

  const body = { name, email, password };

  if (isSuper) {
    body.role = selRole.value;
    if (body.role === "STATION_ADMIN" || body.role === "STAFF") {
      body.stationId = selStation.value || null;
      if (!body.stationId) {
        msg.hidden = false;
        msg.className = "alert alert-error";
        msg.textContent = "Kies een zender voor deze rol.";
        return;
      }
    }
    if (body.role === "STAFF") {
      body.permissions = getCheckedPermissions(permsGrid, "nu-perm");
      if (body.permissions.length === 0) {
        msg.hidden = false;
        msg.className = "alert alert-error";
        msg.textContent = "Kies minimaal één recht voor medewerkers.";
        return;
      }
    }
  }

  if (isStationAdminUser) {
    body.permissions = getCheckedPermissions(permsGrid, "nu-perm");
    if (body.permissions.length === 0) {
      msg.hidden = false;
      msg.className = "alert alert-error";
      msg.textContent = "Kies minimaal één recht.";
      return;
    }
  }

  const res = await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = data.error || "Aanmaken mislukt.";
    return;
  }
  form.reset();
  if (isSuper) {
    toggleStationField();
  }
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.style.color = "var(--color-accent-hover)";
  msg.textContent = "Gebruiker aangemaakt.";
  await loadUsers();
});

(async () => {
  await refreshAuthProfile();
  auth = getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (!canAccessUsers(auth.user?.role)) {
    window.location.href = "/dashboard";
    return;
  }
  isSuper = auth.user?.role === "SUPER_ADMIN";
  isStationAdminUser = auth.user?.role === "STATION_ADMIN";
  applyRoleUi();

  if (!isSuperAdminRole(auth.user?.role)) {
    const feats = await fetchActiveFeatures(true);
    if (!feats?.enabledKeys?.has("users")) {
      window.location.href = "/account";
      return;
    }
  }
  renderPermCheckboxes(permsGrid, "nu-perm", []);
  await loadStationsForSelect();
  toggleStationField();
  togglePermsForStationAdmin();
  await loadUsers();
})();
