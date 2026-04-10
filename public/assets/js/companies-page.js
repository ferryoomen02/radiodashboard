import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { ensurePageSession } from "./portal-session.js";

if (!getAuth()?.token) {
  window.location.href = "/login";
}

const tbody = document.getElementById("co-tbody");
const alertEl = document.getElementById("co-alert");
const form = document.getElementById("form-company");
const msg = document.getElementById("co-msg");

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

async function loadCompanies() {
  alertEl.hidden = true;
  tbody.innerHTML = `<tr><td colspan="4" class="loading-shimmer">Laden…</td></tr>`;
  const res = await apiFetch("/api/companies");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    tbody.innerHTML = "";
    return;
  }
  const data = await res.json();
  const rows = data.companies || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nog geen bedrijven.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (c) => `
    <tr data-id="${escapeHtml(c.id)}">
      <td><input class="input-field" data-field="name" value="${escapeHtml(c.name)}" /></td>
      <td><code style="font-size:0.85rem">${escapeHtml(c.slug)}</code></td>
      <td>${c.stationCount ?? 0}</td>
      <td><button type="button" class="btn-secondary btn-save-co">Opslaan</button></td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll(".btn-save-co").forEach((btn) => {
    btn.addEventListener("click", () => saveRow(btn.closest("tr")));
  });
}

async function saveRow(tr) {
  if (!tr) return;
  alertEl.hidden = true;
  const id = tr.dataset.id;
  const name = tr.querySelector('[data-field="name"]')?.value?.trim() || "";
  if (!name) {
    showAlert("Naam mag niet leeg zijn.");
    return;
  }
  const res = await apiFetch(`/api/companies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showAlert(data.error || "Opslaan mislukt.");
    return;
  }
  await loadCompanies();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const name = document.getElementById("co-name").value.trim();
  let slug = document.getElementById("co-slug").value.trim();
  if (!name) return;
  const body = { name };
  if (slug) body.slug = slug;
  const res = await apiFetch("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.style.color = "var(--color-accent-hover)";
  msg.textContent = "Bedrijf aangemaakt.";
  await loadCompanies();
});

(async () => {
  const session = await ensurePageSession();
  const auth = session.auth || getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (!isSuperAdminRole(auth.user?.role)) {
    window.location.href = "/dashboard";
    return;
  }
  await loadCompanies();
})();
