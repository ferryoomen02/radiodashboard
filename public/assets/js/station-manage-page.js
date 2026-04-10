import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { ensurePageSession } from "./portal-session.js";

function stationIdFromPath() {
  const m = window.location.pathname.match(/^\/station\/([^/]+)/);
  return m ? m[1] : null;
}

const sid = stationIdFromPath();
if (!sid) {
  window.location.href = "/stations";
}

const alertEl = document.getElementById("st-alert");
const titleEl = document.getElementById("st-title");
const subEl = document.getElementById("st-sub");
const form = document.getElementById("form-station");
const msg = document.getElementById("st-msg");
const companySel = document.getElementById("st-company");
const nameInp = document.getElementById("st-name");
const slugInp = document.getElementById("st-slug");
const statusSel = document.getElementById("st-status");
const descInp = document.getElementById("st-desc");
const featuresRoot = document.getElementById("st-features");
const btnFeat = document.getElementById("st-save-features");

/** @type {Set<string>} */
let enabledKeys = new Set();
/** @type {{ key: string, label: string, description?: string|null }[]} */
let definitions = [];

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

function renderFeatures() {
  const labelByKey = {};
  definitions.forEach((d) => {
    labelByKey[d.key] = d.label;
  });
  featuresRoot.innerHTML = definitions
    .map((d) => {
      const on = enabledKeys.has(d.key);
      return `
      <label class="feature-toggle-item">
        <input type="checkbox" data-key="${escapeHtml(d.key)}" ${on ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(d.label || d.key)}</strong>
          <small>${escapeHtml(d.description || d.key)}</small>
        </span>
      </label>`;
    })
    .join("");
}

async function loadCompanies(selectedId) {
  const res = await apiFetch("/api/companies");
  if (!res.ok) return;
  const data = await res.json();
  const list = data.companies || [];
  companySel.innerHTML = list
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.name)}</option>`
    )
    .join("");
}

async function loadAll() {
  alertEl.hidden = true;
  const res = await apiFetch(`/api/stations/${encodeURIComponent(sid)}`);
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    showAlert("Zender niet gevonden of geen toegang.");
    return;
  }
  const st = await res.json();
  titleEl.textContent = st.name || "Zender";
  subEl.textContent = `${st.company?.name || "—"} · ${st.slug || ""} · ${st.status || ""}`;

  nameInp.value = st.name || "";
  slugInp.value = st.slug || "";
  statusSel.value = st.status || "ACTIVE";
  descInp.value = st.description || "";
  await loadCompanies(st.companyId);

  const fr = await apiFetch(`/api/stations/${encodeURIComponent(sid)}/features`);
  if (handleAuthFailure(fr)) return;
  if (!fr.ok) {
    showAlert("Kon functies niet laden.");
    return;
  }
  const fd = await fr.json();
  definitions = fd.definitions || [];
  enabledKeys = new Set(fd.enabledKeys || []);
  renderFeatures();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  const body = {
    name: nameInp.value.trim(),
    slug: slugInp.value.trim(),
    companyId: companySel.value,
    status: statusSel.value,
    description: descInp.value.trim() || null,
  };
  const res = await apiFetch(`/api/stations/${encodeURIComponent(sid)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = data.error || "Opslaan mislukt.";
    return;
  }
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.textContent = "Opgeslagen.";
  await loadAll();
});

btnFeat.addEventListener("click", async () => {
  msg.hidden = true;
  const keys = [];
  featuresRoot.querySelectorAll('input[type="checkbox"][data-key]').forEach((el) => {
    if (el.checked) keys.push(el.getAttribute("data-key"));
  });
  const res = await apiFetch(`/api/stations/${encodeURIComponent(sid)}/features`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabledFeatureKeys: keys }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = data.error || "Opslaan mislukt.";
    return;
  }
  enabledKeys = new Set(data.enabledFeatures || keys);
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.textContent = "Functies opgeslagen.";
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
  await loadAll();
})();
