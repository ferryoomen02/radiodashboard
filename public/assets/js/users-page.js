import { getAuth, canAccessUsers, roleLabelNl, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { ensurePageSession } from "./portal-session.js";
import { redirectNoModuleAccess } from "./portal-routing.js";

let auth = null;
let isSuper = false;
let isStationAdminUser = false;

if (!getAuth()?.token) {
  window.location.href = "/login";
}

/** Opties voor staff-rechten (geen super-only modules zoals stations/invites). */
const PERM_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tracks", label: "Tracks & playlist" },
  { key: "media", label: "Media" },
  { key: "playlist_prep", label: "Playlist prep" },
  { key: "audiologger", label: "Audiologger" },
  { key: "videologger", label: "Videologger" },
  { key: "ai_prepper", label: "AI prepper" },
  { key: "traffic", label: "Verkeer / traffic" },
  { key: "files", label: "Bestanden" },
  { key: "djs", label: "DJ's" },
  { key: "users", label: "Gebruikers" },
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

const editUserDialog = document.getElementById("edit-user-dialog");
const formEditUser = document.getElementById("form-edit-user");
const euId = document.getElementById("eu-id");
const euName = document.getElementById("eu-name");
const euEmail = document.getElementById("eu-email");
const euRole = document.getElementById("eu-role");
const euStationWrap = document.getElementById("eu-station-wrap");
const euStation = document.getElementById("eu-station");
const euPermsWrap = document.getElementById("eu-perms-wrap");
const euPermsGrid = document.getElementById("eu-perms-grid");
const euMsg = document.getElementById("eu-msg");
const euCancel = document.getElementById("eu-cancel");

const deleteUserDialog = document.getElementById("delete-user-dialog");
const duBody = document.getElementById("du-body");
const duConfirm = document.getElementById("du-confirm");
const duCancel = document.getElementById("du-cancel");

let editingUserId = null;
let editingPermUserId = null;
let lastUsers = [];
let pendingDeleteUserId = null;

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

function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function showAlert(t) {
  alertEl.hidden = false;
  alertEl.textContent = t;
}
function hideAlert() {
  alertEl.hidden = true;
}

function countSuperAdmins() {
  return lastUsers.filter((u) => u.role === "SUPER_ADMIN").length;
}

/** Alleen eigen account: backend weigert dit ook. */
function deleteBlockedReason(u) {
  if (!auth?.user?.id || !u) return "Niet toegestaan.";
  if (u.id === auth.user.id) {
    return "Je kunt je eigen account niet verwijderen.";
  }
  return null;
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

function toggleEuFields() {
  const r = euRole.value;
  euStationWrap.hidden = r === "SUPER_ADMIN";
  euPermsWrap.hidden = r !== "STAFF";
}

selRole.addEventListener("change", toggleStationField);
euRole.addEventListener("change", toggleEuFields);

function fillStationSelect(selectEl) {
  selectEl.innerHTML = lastUsers
    .map(() => "")
    .join("");
}

async function loadStationsForSelect() {
  if (!isSuper) return;
  const res = await apiFetch("/api/stations");
  if (!res.ok) return;
  const { stations } = await res.json();
  const opts = (stations || [])
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
    .join("");
  selStation.innerHTML = opts;
  euStation.innerHTML = opts;
  toggleStationField();
}

function renderActionsCell(u) {
  const canEditPerm =
    u.role === "STAFF" &&
    (isSuper || (isStationAdminUser && u.station?.id === getAuth()?.station?.id));

  const parts = [];
  if (canEditPerm) {
    parts.push(
      `<button type="button" class="btn-secondary btn-edit-perm" data-id="${escapeHtml(u.id)}">Rechten</button>`
    );
  }

  if (isSuper) {
    parts.push(
      `<button type="button" class="btn-secondary btn-edit-user" data-id="${escapeHtml(u.id)}">Bewerken</button>`
    );
    const block = deleteBlockedReason(u);
    if (block) {
      parts.push(
        `<button type="button" class="btn-secondary btn-delete-user" data-id="${escapeHtml(u.id)}" disabled title="${escapeAttr(block)}">Verwijderen</button>`
      );
    } else {
      parts.push(
        `<button type="button" class="btn-danger btn-delete-user" data-id="${escapeHtml(u.id)}">Verwijderen</button>`
      );
    }
  }

  if (!parts.length) return "—";
  return `<div class="user-actions">${parts.join(" ")}</div>`;
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
      return `
    <tr data-id="${escapeHtml(u.id)}" data-role="${escapeHtml(u.role)}">
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="role-pill">${escapeHtml(roleLabelNl(u.role))}</span></td>
      <td>${u.station ? escapeHtml(u.station.name) : "—"}</td>
      <td style="font-size:0.8rem;max-width:12rem;word-break:break-word">${escapeHtml(perms)}</td>
      <td>${renderActionsCell(u)}</td>
    </tr>
  `;
    })
    .join("");

  tbody.querySelectorAll(".btn-edit-perm").forEach((btn) => {
    btn.addEventListener("click", () => openEditPermDialog(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-edit-user").forEach((btn) => {
    btn.addEventListener("click", () => openEditUserDialog(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-delete-user:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteUserDialog(btn.getAttribute("data-id")));
  });
}

function openEditPermDialog(userId) {
  const u = lastUsers.find((x) => x.id === userId);
  if (!u || u.role !== "STAFF") return;
  editingPermUserId = userId;
  editPermEmail.textContent = u.email;
  renderPermCheckboxes(editPermGrid, "edit-perm", Array.isArray(u.permissions) ? u.permissions : []);
  editDialog.showModal();
}

function openEditUserDialog(userId) {
  if (!isSuper) return;
  const u = lastUsers.find((x) => x.id === userId);
  if (!u) return;
  editingUserId = userId;
  euMsg.hidden = true;
  euId.value = u.id;
  euName.value = u.name || "";
  euEmail.value = u.email || "";
  euRole.value = u.role;
  if (u.stationId) {
    euStation.value = u.stationId;
  }
  renderPermCheckboxes(euPermsGrid, "eu-perm", Array.isArray(u.permissions) ? u.permissions : []);
  toggleEuFields();
  editUserDialog.showModal();
}

document.getElementById("edit-perm-cancel")?.addEventListener("click", () => editDialog.close());

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingPermUserId) return;
  const permissions = getCheckedPermissions(editPermGrid, "edit-perm");
  if (permissions.length === 0) {
    alert("Kies minimaal één recht.");
    return;
  }
  const res = await apiFetch(`/api/users/${encodeURIComponent(editingPermUserId)}`, {
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
  editingPermUserId = null;
  await loadUsers();
});

euCancel?.addEventListener("click", () => {
  editUserDialog.close();
  editingUserId = null;
});

formEditUser.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingUserId || !isSuper) return;
  euMsg.hidden = true;
  const name = euName.value.trim();
  const email = euEmail.value.trim().toLowerCase();
  const role = euRole.value;
  const body = { name, email, role };
  if (role !== "SUPER_ADMIN") {
    body.stationId = euStation.value || null;
    if (!body.stationId) {
      euMsg.hidden = false;
      euMsg.className = "alert alert-error";
      euMsg.textContent = "Kies een zender voor deze rol.";
      return;
    }
  }
  if (role === "STAFF") {
    body.permissions = getCheckedPermissions(euPermsGrid, "eu-perm");
    if (body.permissions.length === 0) {
      euMsg.hidden = false;
      euMsg.className = "alert alert-error";
      euMsg.textContent = "Kies minimaal één recht voor medewerkers.";
      return;
    }
  }

  const res = await apiFetch(`/api/users/${encodeURIComponent(editingUserId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    euMsg.hidden = false;
    euMsg.className = "alert alert-error";
    euMsg.textContent = data.error || "Opslaan mislukt.";
    return;
  }
  editUserDialog.close();
  editingUserId = null;
  await loadUsers();
});

function openDeleteUserDialog(userId) {
  if (!isSuper) return;
  const u = lastUsers.find((x) => x.id === userId);
  if (!u) return;
  const block = deleteBlockedReason(u);
  if (block) return;
  pendingDeleteUserId = userId;
  const stationNote = u.station
    ? ` Deze gebruiker staat gekoppeld aan zender <strong>${escapeHtml(u.station.name)}</strong>.`
    : "";
  const superWarn =
    u.role === "SUPER_ADMIN" && countSuperAdmins() <= 1
      ? `<p class="alert alert-error" style="margin:0.75rem 0 0;font-size:0.875rem"><strong>Let op:</strong> dit is de enige super admin. Na verwijderen is er geen account meer met volledig platformbeheer tot je via de database of een herstelprocedure een nieuwe aanmaakt.</p>`
      : u.role === "SUPER_ADMIN"
        ? `<p class="empty-state" style="margin:0.75rem 0 0;font-size:0.8125rem">Super admin-accounts hebben toegang tot alle zenders en beheerfuncties.</p>`
        : "";
  duBody.innerHTML = `Je staat op het punt om <strong>${escapeHtml(u.name)}</strong> (${escapeHtml(u.email)}) te verwijderen.${stationNote} Dit account is daarna niet meer bruikbaar.${superWarn}`;
  deleteUserDialog.showModal();
}

duCancel?.addEventListener("click", () => {
  deleteUserDialog.close();
  pendingDeleteUserId = null;
});

duConfirm?.addEventListener("click", async () => {
  if (!pendingDeleteUserId || !isSuper) return;
  const id = pendingDeleteUserId;
  const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || "Verwijderen mislukt.");
    return;
  }
  deleteUserDialog.close();
  pendingDeleteUserId = null;
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
  const session = await ensurePageSession();
  auth = session.auth || getAuth();
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
    const feats = session.features;
    if (!feats?.enabledKeys?.has("users")) {
      redirectNoModuleAccess("users: geen users-module voor deze rol/station");
      return;
    }
  }
  renderPermCheckboxes(permsGrid, "nu-perm", []);
  await loadStationsForSelect();
  toggleStationField();
  togglePermsForStationAdmin();
  await loadUsers();
})();
