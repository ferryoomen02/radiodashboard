function applyBranding(station, root) {
  if (!station) return;
  root.style.setProperty("--sp-primary", station.primaryColor || "#1e293b");
  root.style.setProperty("--sp-accent", station.accentColor || "#da2e20");
  document.title = `${station.name} — luister live`;

  const title = document.getElementById("sp-title");
  const desc = document.getElementById("sp-desc");
  const logo = document.getElementById("sp-logo");
  const slot = document.getElementById("sp-logo-slot");

  if (title) title.textContent = station.name;
  if (desc) {
    desc.textContent = station.description?.trim() || "Welkom op de site van deze zender.";
  }

  if (station.logoUrl && logo && slot) {
    logo.src = station.logoUrl;
    logo.alt = station.name;
    logo.removeAttribute("hidden");
    slot.setAttribute("hidden", "");
  } else if (slot && station.name) {
    slot.textContent = station.name.trim().slice(0, 1).toUpperCase();
  }
}

(async () => {
  const root = document.getElementById("station-public-root");
  try {
    const res = await fetch("/api/public/station");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.mode !== "station" || !data.station) {
      window.location.replace("/login");
      return;
    }
    applyBranding(data.station, root);
  } catch {
    window.location.replace("/login");
  }
})();
