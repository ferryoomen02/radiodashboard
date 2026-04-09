import { getAuth, canAccessUsers, roleLabelNl } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";

const auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}
if (!canAccessUsers(auth.user?.role)) {
  window.location.href = "/dashboard";
}

const isSuper = auth.user?.role === "SUPER_ADMIN";
const tbody = document.getElementById("users-tbody");
const alertEl = document.getElementById("users-alert");
const roleWrap = document.getElementById("nu-role-wrap");
const stationWrap = document.getElementById("nu-station-wrap");
const hintSa = document.getElementById("nu-hint-station-admin");
const form = document.getElementById("form-new-user");
const msg = document.getElementById("nu-msg");
const selRole = document.getElementById("nu-role");
const selStation = document.getElementById("nu-station");

if (isSuper) {
  roleWrap.hidden = false;
  stationWrap.hidden = false;
} else {
  hintSa.hidden = false;
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

function toggleStationField() {
  if (!isSuper) return;
  const r = selRole.value;
  const need = r === "STATION_ADMIN" || r === "USER";
  stationWrap.hidden = !need;
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
  tbody.innerHTML = `<tr><td colspan="4" class="loading-shimmer">Laden…</td></tr>`;
  const res = await apiFetch("/api/users");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    tbody.innerHTML = "";
    return;
  }
  const { users } = await res.json();
  if (!users?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nog geen gebruikers.</td></tr>`;
    return;
  }
  tbody.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="role-pill">${escapeHtml(roleLabelNl(u.role))}</span></td>
      <td>${u.station ? escapeHtml(u.station.name) : "—"}</td>
    </tr>
  `
    )
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const name = document.getElementById("nu-name").value.trim();
  const email = document.getElementById("nu-email").value.trim().toLowerCase();
  const password = document.getElementById("nu-password").value;

  const body = { name, email, password };

  if (isSuper) {
    body.role = selRole.value;
    if (body.role === "STATION_ADMIN" || body.role === "USER") {
      body.stationId = selStation.value || null;
      if (!body.stationId) {
        msg.hidden = false;
        msg.className = "alert alert-error";
        msg.textContent = "Kies een zender voor deze rol.";
        return;
      }
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
  await loadStationsForSelect();
  await loadUsers();
})();
