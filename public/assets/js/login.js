import { setAuth, getAuth, displayNameFromEmail } from "./portal-auth.js";
import { swLog, swLogRedirect, SONICWAVE_DEBUG } from "./portal-debug.js";
import { clearActiveFeaturesCache } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { logAuthRouting } from "./portal-routing.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

async function tryRedirectIfLoggedIn() {
  const auth = getAuth();
  if (!auth?.token) {
    swLog("login", "tryRedirect: geen token in localStorage, blijf op loginpagina");
    return;
  }
  swLog("login", "tryRedirect: token aanwezig, refreshAuthProfile …");
  clearActiveFeaturesCache();
  await refreshAuthProfile();
  logAuthRouting("tryRedirectIfLoggedIn", { role: getAuth()?.user?.role });
  if (getAuth()?.token) {
    swLogRedirect("/dashboard", "tryRedirect: nog ingelogd → /dashboard");
    window.location.href = "/dashboard";
  }
}

function showError(msg) {
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showError(data.error || "Inloggen mislukt.");
      submitBtn.disabled = false;
      return;
    }
    if (!data.token) {
      showError("Geen token ontvangen.");
      submitBtn.disabled = false;
      return;
    }

    setAuth({
      token: data.token,
      user: data.user,
      station: data.station,
    });
    clearActiveFeaturesCache();

    const refreshed = await refreshAuthProfile();
    logAuthRouting("login-submit", {
      roleFromLogin: data.user?.role,
      roleAfterRefresh: getAuth()?.user?.role,
      refreshOk: Boolean(refreshed),
    });
    if (!refreshed && SONICWAVE_DEBUG) {
      console.warn("[SonicWave auth] refresh na login mislukt — gebruik login-response in storage");
    }

    const ga = getAuth();
    const display =
      (ga?.user?.name && ga.user.name.trim()) || displayNameFromEmail(ga?.user?.email ?? data.user?.email);
    sessionStorage.setItem("portalDisplayName", display);

    swLogRedirect("/dashboard", "login formulier succes (na refreshAuthProfile)");
    window.location.href = "/dashboard";
  } catch (err) {
    swLog("login", "submit: netwerkfout", String(err));
    showError("Netwerkfout. Controleer of de server draait.");
    submitBtn.disabled = false;
  }
});

tryRedirectIfLoggedIn();
