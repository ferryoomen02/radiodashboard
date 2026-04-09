import { getAuth, clearAuth } from "./portal-auth.js";
import { swLog, swLogRedirect, SONICWAVE_DEBUG } from "./portal-debug.js";

let swFetchSeq = 0;

export async function apiFetch(path, options = {}) {
  const auth = getAuth();
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const method = options.method || "GET";
  if (SONICWAVE_DEBUG) {
    swFetchSeq += 1;
    console.debug("[SonicWave fetch]", `#${swFetchSeq}`, method, path, { hasAuth: Boolean(auth?.token) });
    swLog("fetch", "start", { method, path, hasAuth: Boolean(auth?.token) });
  }
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch (err) {
    swLog("fetch", "NETWERK-FOUT (geen response)", { path, error: String(err) });
    throw err;
  }

  if (SONICWAVE_DEBUG) {
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : "?";
    swLog("fetch", `antwoord ${res.status}`, `${path} (${ms}ms)`);
  }
  return res;
}

/** Bij 401: uitloggen en naar login */
export function handleAuthFailure(res) {
  if (res.status === 401) {
    swLog("auth", "401 → clearAuth + redirect /login", res.url || "");
    clearAuth();
    swLogRedirect("/login", "handleAuthFailure 401");
    window.location.href = "/login";
    return true;
  }
  return false;
}

export function withStationQuery(path, stationId) {
  if (!stationId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}stationId=${encodeURIComponent(stationId)}`;
}
