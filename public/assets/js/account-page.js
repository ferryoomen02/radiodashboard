import { getAuth } from "./portal-auth.js";
import { apiFetch, handleAuthFailure } from "./portal-api.js";

if (!getAuth()?.token) {
  window.location.href = "/login";
}

const form = document.getElementById("form-password");
const msg = document.getElementById("pw-msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;

  const currentPassword = document.getElementById("pw-current").value;
  const newPassword = document.getElementById("pw-new").value;
  const new2 = document.getElementById("pw-new2").value;

  if (newPassword !== new2) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = "Nieuwe wachtwoorden komen niet overeen.";
    return;
  }

  const res = await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (handleAuthFailure(res)) return;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    msg.hidden = false;
    msg.className = "alert alert-error";
    msg.textContent = data.error || "Wijzigen mislukt.";
    return;
  }

  form.reset();
  msg.hidden = false;
  msg.className = "alert";
  msg.style.background = "var(--color-accent-soft)";
  msg.style.color = "var(--color-accent-hover)";
  msg.textContent = data.message || "Wachtwoord bijgewerkt.";
});
