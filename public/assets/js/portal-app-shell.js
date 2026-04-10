/**
 * Client-side portaal-shell: zelfde document, alleen .main-wrap wisselt.
 * Sidebar + portal-session + branding-cache blijven in geheugen; geen tweede sidebar-mount,
 * geen tweede ensurePageSession-keten na de eerste succesvolle load.
 *
 * Pagina-scripts worden per navigatie opnieuw geëvalueerd via dynamic import (?__swNav=…)
 * zodat top-level init opnieuw draait tegen de nieuwe DOM.
 */

import { SONICWAVE_DEBUG } from "./portal-debug.js";

/** padname (zonder trailing slash, behalve /) → ES-module pad */
export const PORTAL_SHELL_ROUTES = {
  "/dashboard": "/assets/js/dashboard.js",
  "/stations": "/assets/js/stations-page.js",
  "/users": "/assets/js/users-page.js",
  "/account": "/assets/js/account-page.js",
  "/station-features": "/assets/js/station-features-page.js",
  "/invites": "/assets/js/invites-page.js",
  "/djs": "/assets/js/feature-placeholder-page.js",
  "/audiologger": "/assets/js/feature-placeholder-page.js",
  "/files": "/assets/js/feature-placeholder-page.js",
  "/site-settings": "/assets/js/feature-placeholder-page.js",
  "/media": "/assets/js/media-page.js",
  "/settings": "/assets/js/settings-page.js",
};

function normalizePathname(p) {
  if (!p || p === "/") return p || "/";
  return p.replace(/\/+$/, "") || "/";
}

function swShellLog(phase, detail = {}) {
  if (!SONICWAVE_DEBUG) return;
  const t = new Date().toISOString().slice(11, 23);
  console.info(`[SonicWave shell ${t}]`, phase, detail);
}

let shellNavigateLocked = false;
let shellNavGeneration = 0;

function isLoginDocument(doc) {
  return !!(doc.querySelector(".login-page") || doc.querySelector("#login-form"));
}

function getRouteModule(pathname) {
  const p = normalizePathname(pathname);
  return PORTAL_SHELL_ROUTES[p] || null;
}

function shouldHandleShellLink(anchor, e) {
  if (!anchor || anchor.tagName !== "A") return false;
  if (e.defaultPrevented) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (e.button !== 0) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
  let u;
  try {
    u = new URL(href, window.location.origin);
  } catch {
    return false;
  }
  if (u.origin !== window.location.origin) return false;
  const path = normalizePathname(u.pathname);
  return getRouteModule(path) !== null;
}

/**
 * @param {string} pathname — genormaliseerd portaalpad
 * @param {{ pop?: boolean }} opts
 */
export async function navigateShell(pathname, opts = {}) {
  const pop = opts.pop === true;
  const path = normalizePathname(pathname);
  const modFile = getRouteModule(path);
  if (!modFile || shellNavigateLocked) {
    swShellLog("navigate:skip", { path, reason: !modFile ? "geen route" : "locked" });
    return;
  }

  shellNavigateLocked = true;
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  try {
    const prevDispose = window.__swShellPageDispose;
    if (typeof prevDispose === "function") {
      swShellLog("dispose:voor-import", {});
      try {
        prevDispose();
      } catch (err) {
        console.warn("[SonicWave shell] dispose fout", err);
      }
    }
    window.__swShellPageDispose = null;

    const url = new URL(path, window.location.origin).href;
    swShellLog("fetch:start", { url, pop });

    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html" },
    });

    const fetchMs = Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);
    swShellLog("fetch:done", { status: res.status, fetchMs });

    if (typeof window !== "undefined" && window.__swPerf) {
      window.__swPerf.shellNavigations = (window.__swPerf.shellNavigations || 0) + 1;
      window.__swPerf.shellLastFetchMs = fetchMs;
    }

    if (!res.ok) {
      swShellLog("fetch:fallback-full-nav", { status: res.status });
      window.location.assign(url);
      return;
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (isLoginDocument(doc)) {
      swShellLog("response:login-html", { fallback: true });
      window.location.assign(url);
      return;
    }

    const newMain = doc.querySelector(".dashboard .main-wrap");
    const curMain = document.querySelector(".dashboard .main-wrap");
    if (!newMain || !curMain) {
      swShellLog("dom:geen-main-wrap", { fallback: true });
      window.location.assign(url);
      return;
    }

    curMain.replaceWith(newMain.cloneNode(true));

    const titleEl = doc.querySelector("title");
    if (titleEl?.textContent) {
      document.title = titleEl.textContent.trim();
    }

    const pb = doc.body;
    if (pb?.dataset) {
      if (pb.dataset.page != null) document.body.dataset.page = pb.dataset.page;
      else delete document.body.dataset.page;
      if (pb.dataset.featureKey != null) document.body.dataset.featureKey = pb.dataset.featureKey;
      else delete document.body.dataset.featureKey;
    }

    if (!pop) {
      history.pushState({ __swShell: true }, "", path);
    }

    window.scrollTo(0, 0);

    if (window.swSyncSidebarActiveFromRoute) {
      window.swSyncSidebarActiveFromRoute();
    }

    shellNavGeneration += 1;
    const importUrl = `${new URL(modFile, window.location.origin).href}?__swNav=${shellNavGeneration}`;
    swShellLog("import:dynamic", { importUrl });

    await import(/* @vite-ignore */ importUrl);

    swShellLog("navigate:klaar", { path, totalMs: Math.round(performance.now() - t0) });
  } catch (err) {
    console.error("[SonicWave shell] navigate fout", err);
    swShellLog("navigate:error", { message: String(err?.message || err), fallback: true });
    window.location.assign(new URL(path, window.location.origin).href);
  } finally {
    shellNavigateLocked = false;
  }
}

function onPopState() {
  const path = normalizePathname(window.location.pathname);
  if (!getRouteModule(path)) return;
  swShellLog("popstate", { path });
  void navigateShell(path, { pop: true });
}

/**
 * @returns {boolean} true als soft-nav afhandelt (defaultPrevented)
 */
export function tryConsumeShellNavigationClick(e, anchor) {
  if (!window.__swPortalShellActive) return false;
  if (!shouldHandleShellLink(anchor, e)) return false;

  const href = anchor.getAttribute("href");
  let u;
  try {
    u = new URL(href, window.location.origin);
  } catch {
    return false;
  }
  const path = normalizePathname(u.pathname);
  if (path === normalizePathname(window.location.pathname)) {
    e.preventDefault();
    window.scrollTo(0, 0);
    return true;
  }

  e.preventDefault();
  void navigateShell(path, { pop: false });
  return true;
}

export function initPortalAppShell() {
  if (typeof window === "undefined") return;
  if (window.__swPortalShellInitDone) return;
  if (!document.querySelector(".dashboard") || !document.getElementById("sidebar-root")) return;
  if (document.querySelector(".login-page")) return;

  window.__swPortalShellInitDone = true;
  window.__swPortalShellActive = true;

  try {
    history.scrollRestoration = "manual";
  } catch {
    /* ignore */
  }

  window.addEventListener("popstate", onPopState);

  if (SONICWAVE_DEBUG) {
    console.info("[SonicWave shell] actief — portaalnavigatie wisselt alleen main-content; sidebar blijft gemount.", {
      routes: Object.keys(PORTAL_SHELL_ROUTES).length,
    });
  }
}
