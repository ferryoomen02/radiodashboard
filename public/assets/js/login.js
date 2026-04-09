import { setAuth, getAuth, displayNameFromEmail } from "./portal-auth.js";
import { swLog, swLogRedirect } from "./portal-debug.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

async function tryRedirectIfLoggedIn() {
  const auth = getAuth();
  if (!auth?.token) {
    swLog("login", "tryRedirect: geen token in localStorage, blijf op loginpagina");
    return;
  }
  swLog("login", "tryRedirect: token aanwezig, GET /auth/me …");
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const res = await fetch("/auth/me", {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : "?";
    swLog("login", `/auth/me status ${res.status}`, `(${ms}ms)`);
    if (res.ok) {
      swLogRedirect("/dashboard", "tryRedirect: /auth/me OK");
      window.location.href = "/dashboard";
    } else {
      swLog("login", "tryRedirect: /auth/me niet OK, blijf op login (geen redirect)");
    }
  } catch (err) {
    swLog("login", "tryRedirect: FETCH GEFAALD (hangt vaak hier bij verkeerde API-URL/CORS)", String(err));
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

    const display =
      (data.user?.name && data.user.name.trim()) || displayNameFromEmail(data.user?.email);
    sessionStorage.setItem("portalDisplayName", display);

    swLogRedirect("/dashboard", "login formulier succes");
    window.location.href = "/dashboard";
  } catch (err) {
    swLog("login", "submit: netwerkfout", String(err));
    showError("Netwerkfout. Controleer of de server draait.");
    submitBtn.disabled = false;
  }
});

tryRedirectIfLoggedIn();
