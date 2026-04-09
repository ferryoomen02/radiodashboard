import { setAuth, getAuth } from "./portal-auth.js";
import { clearActiveFeaturesCache } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { logAuthRouting } from "./portal-routing.js";

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function show(el, on) {
  if (!el) return;
  el.hidden = !on;
}

const subtitle = document.getElementById("invite-subtitle");
const invalid = document.getElementById("invite-invalid");
const form = document.getElementById("register-form");
const err = document.getElementById("register-error");

const token = qs("token");

async function main() {
  if (!token) {
    subtitle.textContent = "Geen uitnodiging in de link.";
    invalid.hidden = false;
    invalid.textContent = "Open de link uit je uitnodigingsmail (met ?token=…).";
    return;
  }

  const res = await fetch(`/auth/invite/preview?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!data.valid) {
    subtitle.textContent = "Uitnodiging ongeldig";
    invalid.hidden = false;
    invalid.textContent = data.error || "Deze uitnodiging kan niet worden gebruikt.";
    return;
  }

  subtitle.textContent = "Stel je wachtwoord in om je account te voltooien.";
  const emailInput = document.getElementById("reg-email");
  if (emailInput) {
    emailInput.value = data.email || "";
  }
  show(form, true);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = document.getElementById("reg-name").value.trim();
    const password = document.getElementById("reg-password").value;
    if (!name || password.length < 6) {
      err.hidden = false;
      err.textContent = "Vul je naam in en een wachtwoord van minimaal 6 tekens.";
      return;
    }

    const reg = await fetch("/auth/register-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    const body = await reg.json().catch(() => ({}));
    if (!reg.ok) {
      err.hidden = false;
      err.textContent = body.error || `Fout (${reg.status})`;
      return;
    }

    setAuth({
      token: body.token,
      user: body.user,
      station: body.station ?? null,
    });
    clearActiveFeaturesCache();
    await refreshAuthProfile();
    logAuthRouting("register-invite", { role: getAuth()?.user?.role });
    window.location.href = "/dashboard";
  });
}

main();
