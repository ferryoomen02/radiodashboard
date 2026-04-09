const KEY = "sonicwaveActiveStationId";

/** Actieve zender voor API-calls (super_admin: uit session; anderen: vaste koppeling). */
export function getActiveStationIdForApi(auth) {
  if (!auth?.user) return null;
  if (auth.user.role === "SUPER_ADMIN") {
    return sessionStorage.getItem(KEY) || null;
  }
  return auth.station?.id || null;
}

export function setActiveStationId(id) {
  if (id) sessionStorage.setItem(KEY, id);
  else sessionStorage.removeItem(KEY);
}
