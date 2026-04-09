import { setAuth, getAuth, displayNameFromEmail } from "./portal-auth.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

async function tryRedirectIfLoggedIn() {
  const auth = getAuth();
  if (!auth?.token) return;
  const res = await fetch("/auth/me", {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (res.ok) {
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

    const display =
      (data.user?.name && data.user.name.trim()) || displayNameFromEmail(data.user?.email);
    sessionStorage.setItem("portalDisplayName", display);

    window.location.href = "/dashboard";
  } catch {
    showError("Netwerkfout. Controleer of de server draait.");
    submitBtn.disabled = false;
  }
});

tryRedirectIfLoggedIn();
