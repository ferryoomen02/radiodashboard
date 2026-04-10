/**
 * Synchrone actieve menu-state op basis van location.pathname.
 * Geen auth/features — alleen DOM. Gebruikt door sidebar-restore (vóór modules) en portal-navigation.
 */
(function (w) {
  function normPath(p) {
    if (!p) return "/";
    var x = String(p).replace(/\/$/, "");
    return x || "/";
  }

  function syncFromRoute() {
    var root = document.getElementById("sidebar-root");
    if (!root) return;
    var navItems = root.querySelector("#sidebar-nav-items");
    if (!navItems) return;
    var path = normPath(w.location.pathname);
    navItems.querySelectorAll("a.nav-item[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href) return;
      var hrefPath;
      try {
        hrefPath = normPath(new URL(href, w.location.origin).pathname);
      } catch (e) {
        return;
      }
      a.classList.remove("is-active");
      a.removeAttribute("aria-current");
      if (hrefPath === path) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  function applyClickActive(anchor) {
    if (!anchor || !anchor.classList || !anchor.classList.contains("nav-item")) return;
    var navItems = document.getElementById("sidebar-nav-items");
    if (!navItems || !navItems.contains(anchor)) return;
    navItems.querySelectorAll("a.nav-item").forEach(function (a) {
      a.classList.remove("is-active");
      a.removeAttribute("aria-current");
    });
    anchor.classList.add("is-active");
    anchor.setAttribute("aria-current", "page");
  }

  w.swSyncSidebarActiveFromRoute = syncFromRoute;
  w.swApplySidebarClickActive = applyClickActive;
})(typeof window !== "undefined" ? window : globalThis);
