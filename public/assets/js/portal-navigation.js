/**
 * MPA-navigatie: geen SPA, wel vloeiendere ervaring.
 * - Prefetch van portaalpagina’s bij eerste hover op sidebar-links (minder wachttijd bij klik).
 * - Subtiele “leaving”-state vóór unload (alleen zichtbaar als de browser nog een frame tekent).
 * Volledige pagina’s laden nog steeds; dat is bewust (server-HTML + per-pagina scripts).
 */

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
  const sidebar = document.getElementById("sidebar-root");
  if (sidebar) {
    bindSidebarLinkPrefetch(sidebar);
    const mo = new MutationObserver(() => bindSidebarLinkPrefetch(sidebar));
    mo.observe(sidebar, { childList: true, subtree: true });
  }

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest("a");
      if (!isSameOriginPortalLink(a)) return;
      document.documentElement.classList.add("portal-nav-is-leaving");
    },
    true
  );

  window.addEventListener("pageshow", () => {
    document.documentElement.classList.remove("portal-nav-is-leaving");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onReady);
} else {
  onReady();
}
