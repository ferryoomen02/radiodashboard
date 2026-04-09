import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";
import { ensurePageSession } from "./portal-session.js";
import { clearPlatformBrandingCache, fetchPlatformBranding } from "./portal-branding.js";

const formLogo = document.getElementById("form-logo");
const formText = document.getElementById("form-brand-text");
const logoFile = document.getElementById("settings-logo-file");
const logoMsg = document.getElementById("settings-logo-msg");
const saveMsg = document.getElementById("settings-save-msg");
const previewWrap = document.getElementById("settings-logo-preview-wrap");
const previewImg = document.getElementById("settings-logo-preview");
const btnRemoveLogo = document.getElementById("settings-remove-logo");

function show(el, ok, text) {
  el.hidden = false;
  el.className = ok ? "alert" : "alert alert-error";
  el.style.background = ok ? "var(--color-accent-soft)" : undefined;
  el.style.color = ok ? "var(--color-accent-hover)" : undefined;
  el.textContent = text;
}

function updatePreview(data) {
  if (data?.logoUrl) {
    previewImg.src = data.logoUrl;
    previewWrap.hidden = false;
    btnRemoveLogo.hidden = false;
  } else {
    previewWrap.hidden = true;
    btnRemoveLogo.hidden = true;
    previewImg.removeAttribute("src");
  }
}

async function loadForm() {
  const res = await apiFetch("/api/platform-settings");
  if (handleAuthFailure(res)) return;
  if (!res.ok) {
    show(saveMsg, false, "Kon instellingen niet laden.");
    return;
  }
  const data = await res.json();
  document.getElementById("settings-platform-name").value = data.platformName || "";
  document.getElementById("settings-subtitle").value = data.subtitle ?? "";
  document.getElementById("settings-welcome-title").value = data.texts?.dashboardWelcomeTitle ?? "";
  document.getElementById("settings-welcome-text").value = data.texts?.dashboardWelcomeText ?? "";
  updatePreview(data);
}

formText.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveMsg.hidden = true;
  const platformName = document.getElementById("settings-platform-name").value.trim();
  const subtitle = document.getElementById("settings-subtitle").value.trim();
  const dashboardWelcomeTitle = document.getElementById("settings-welcome-title").value.trim();
  const dashboardWelcomeText = document.getElementById("settings-welcome-text").value.trim();

  const res = await apiFetch("/api/platform-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platformName,
      subtitle,
      texts: { dashboardWelcomeTitle, dashboardWelcomeText },
    }),
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    show(saveMsg, false, data.error || "Opslaan mislukt.");
    return;
  }
  clearPlatformBrandingCache();
  await fetchPlatformBranding(true);
  show(saveMsg, true, "Opgeslagen.");
  updatePreview(data);
});

formLogo.addEventListener("submit", async (e) => {
  e.preventDefault();
  logoMsg.hidden = true;
  const file = logoFile.files?.[0];
  if (!file) {
    show(logoMsg, false, "Kies een afbeeldingsbestand.");
    return;
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch("/api/platform-settings/logo", {
    method: "POST",
    body: fd,
  });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    show(logoMsg, false, data.error || "Upload mislukt.");
    return;
  }
  clearPlatformBrandingCache();
  await fetchPlatformBranding(true);
  show(logoMsg, true, data.message || "Logo opgeslagen.");
  logoFile.value = "";
  updatePreview(data);
});

btnRemoveLogo.addEventListener("click", async () => {
  if (!confirm("Logo verwijderen?")) return;
  logoMsg.hidden = true;
  const res = await apiFetch("/api/platform-settings/logo", { method: "DELETE" });
  if (handleAuthFailure(res)) return;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    show(logoMsg, false, data.error || "Verwijderen mislukt.");
    return;
  }
  clearPlatformBrandingCache();
  await fetchPlatformBranding(true);
  show(logoMsg, true, "Logo verwijderd.");
  updatePreview(data);
});

(async () => {
  await ensurePageSession();
  const auth = getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (!isSuperAdminRole(auth.user?.role)) {
    window.location.href = "/dashboard";
    return;
  }
  await loadForm();
})();
