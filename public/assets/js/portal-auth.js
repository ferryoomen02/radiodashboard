const AUTH_KEY = "portalAuth";

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.token) return null;
    return data;
  } catch {
    return null;
  }
}

export function setAuth(payload) {
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      token: payload.token,
      user: payload.user,
      station: payload.station,
    })
  );
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function displayNameFromEmail(email) {
  if (!email || typeof email !== "string") return "DJ";
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length === 0) return "DJ";
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function greetingName(auth) {
  if (!auth?.user) return "DJ";
  if (auth.user.name && auth.user.name.trim()) return auth.user.name.trim();
  return displayNameFromEmail(auth.user.email);
}

export function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Goedemorgen";
  if (h < 18) return "Goedemiddag";
  return "Goedenavond";
}

export function formatDateNl(d = new Date()) {
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function canAccessStations(role) {
  return role === "SUPER_ADMIN" || role === "STATION_ADMIN";
}

export function canAccessUsers(role) {
  return role === "SUPER_ADMIN" || role === "STATION_ADMIN";
}

export function roleLabelNl(role) {
  const m = {
    SUPER_ADMIN: "Super admin",
    STATION_ADMIN: "Station admin",
    USER: "Gebruiker",
  };
  return m[role] || role;
}
