import { setAuth, getAuth, displayNameFromEmail } from "./portal-auth.js";
import { swLog, swLogRedirect, SONICWAVE_DEBUG } from "./portal-debug.js";
import { clearActiveFeaturesCache } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { logAuthRouting } from "./portal-routing.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");
const tenantErr = document.getElementById("login-tenant-error");

let unknownTenant = false;

async function loadTenantContext() {
  const res = await fetch("/api/public/station");
  const data = await res.json().catch(() => ({}));

  if (res.status === 404 && data.mode === "unknown") {
    unknownTenant = true;
    if (tenantErr) {
      tenantErr.hidden = false;
      tenantErr.textContent =
        data.error || "Dit subdomein hoort bij geen actieve zender. Controleer het webadres.";
    }
    if (form) {
      form.querySelectorAll("input").forEach((el) => {
        el.disabled = true;
      });
    }
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (data.mode === "station" && data.station) {
    const shell = document.getElementById("login-shell");
    const st = data.station;
    shell?.classList.add("station-portal-scope");
    shell?.style.setProperty("--sp-primary", st.primaryColor || "#1e293b");
    shell?.style.setProperty("--sp-accent", st.accentColor || "#da2e20");

    const logo = document.getElementById("login-brand-logo");
    const letter = document.getElementById("login-brand-letter");
    if (st.logoUrl && logo && letter) {
      logo.src = st.logoUrl;
      logo.alt = st.name;
      logo.hidden = false;
      letter.classList.add("hidden");
    } else if (letter && st.name) {
      letter.textContent = st.name.slice(0, 1).toUpperCase();
    }

    const titleEl = document.getElementById("login-title");
    const subEl = document.getElementById("login-subtitle");
    if (titleEl) titleEl.textContent = st.name;
    if (subEl) subEl.textContent = "Inloggen voor medewerkers";
    document.title = `Inloggen — ${st.name}`;

    const foot = document.getElementById("login-footer-text");
    if (foot) foot.textContent = `Zenderportaal — ${st.name}`;

    const regWrap = document.getElementById("login-register-wrap");
    const regLink = document.getElementById("login-register-link");
    const central = data.links?.centralPortalUrl;
    if (regWrap && regLink) {
      if (central) {
        regLink.href = `${central.replace(/\/$/, "")}/register`;
      } else {
        regWrap.hidden = true;
      }
    }
  }
}

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
  if (unknownTenant) return;
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

(async () => {
  await loadTenantContext();
  await tryRedirectIfLoggedIn();
})();
