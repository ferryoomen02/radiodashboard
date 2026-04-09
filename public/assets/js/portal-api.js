import { getAuth, clearAuth } from "./portal-auth.js";

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

  const res = await fetch(path, { ...options, headers });
  return res;
}

/** Bij 401: uitloggen en naar login */
export function handleAuthFailure(res) {
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    return true;
  }
  return false;
}
