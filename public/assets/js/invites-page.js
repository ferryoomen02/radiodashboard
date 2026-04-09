import { getAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { fetchActiveFeatures } from "./portal-features.js";

const auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}
if (auth.user?.role !== "SUPER_ADMIN") {
  window.location.href = "/dashboard";
}

const tbody = document.getElementById("invites-tbody");
const alertEl = document.getElementById("invites-alert");
const form = document.getElementById("form-invite");
const msg = document.getElementById("invite-msg");

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

async function loadInvites() {
  alertEl.hidden = true;
  tbody.innerHTML = `<tr><td colspan="3" class="loading-shimmer">Laden…</td></tr>`;
  const res = await apiFetch("/api/invites");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showAlert(e.error || "Laden mislukt.");
    tbody.innerHTML = "";
    return;
  }
  const data = await res.json();
  const rows = data.invites || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Geen openstaande uitnodigingen.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.role)}</td>
      <td>${escapeHtml(new Date(r.expiresAt).toLocaleString("nl-NL"))}</td>
    </tr>`
    )
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const email = document.getElementById("invite-email").value.trim().toLowerCase();
  if (!email) return;

  const res = await apiFetch("/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
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
  const link = data.inviteUrl || "";
  msg.innerHTML = `Uitnodiging aangemaakt. Deel deze link met de ontvanger:<br/><code style="word-break:break-all;font-size:0.85rem">${escapeHtml(link)}</code>${data.hint ? `<br/><span style="font-size:0.85rem">${escapeHtml(data.hint)}</span>` : ""}`;
  await loadInvites();
});

(async () => {
  const feats = await fetchActiveFeatures();
  if (!feats?.enabledKeys?.has("invites")) {
    window.location.href = "/account";
    return;
  }
  await loadInvites();
})();
