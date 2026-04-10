/**
 * Portaalnavigatie:
 * - App-shell: zelfde document; alleen .main-wrap wisselt (portal-app-shell.js). Sidebar + sessie blijven gemount.
 * - Prefetch op hover; “leaving”-class alleen bij echte volledige paginanavigatie.
 */

import { initPortalAppShell, tryConsumeShellNavigationClick } from "./portal-app-shell.js";

const prefetchedUrls = new Set();

function isSameOriginPortalLink(anchor) {
  if (!anchor || anchor.tagName !== "A") return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const u = new URL(href, window.location.origin);
    return u.origin === window.location.origin && u.pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

function prefetchHtmlDocument(url) {
  if (prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.as = "document";
  document.head.appendChild(link);
}

function bindSidebarLinkPrefetch(root) {
  root.querySelectorAll('a.nav-item[href^="/"]').forEach((a) => {
    if (a.dataset.swPrefetchBound === "1") return;
    a.dataset.swPrefetchBound = "1";
    const href = a.getAttribute("href");
    if (!href) return;
    a.addEventListener(
      "pointerenter",
      () => {
        prefetchHtmlDocument(new URL(href, window.location.origin).href);
      },
      { passive: true, once: true }
    );
  });
}

function onReady() {
  initPortalAppShell();

  const sidebarRoot = document.getElementById("sidebar-root");
  if (sidebarRoot) {
    bindSidebarLinkPrefetch(sidebarRoot);
    const mo = new MutationObserver(() => bindSidebarLinkPrefetch(sidebarRoot));
    mo.observe(sidebarRoot, { childList: true, subtree: true });
  }

  document.addEventListener(
    "click",
    (e) => {
      const anchor = e.target.closest("a");
      if (!anchor) return;

      if (tryConsumeShellNavigationClick(e, anchor)) {
        return;
      }

      const navA = anchor.classList.contains("nav-item") ? anchor : null;
      if (navA && sidebarRoot && sidebarRoot.contains(navA)) {
        const href = navA.getAttribute("href");
        if (href && !href.startsWith("#")) {
          try {
            const u = new URL(href, window.location.origin);
            if (u.origin === window.location.origin && window.swApplySidebarClickActive) {
              window.swApplySidebarClickActive(navA);
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (!isSameOriginPortalLink(anchor)) return;
      document.documentElement.classList.add("portal-nav-is-leaving");
    },
    true
  );

  window.addEventListener("pageshow", () => {
    document.documentElement.classList.remove("portal-nav-is-leaving");
    if (window.swSyncSidebarActiveFromRoute) {
      window.swSyncSidebarActiveFromRoute();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onReady);
} else {
  onReady();
}
