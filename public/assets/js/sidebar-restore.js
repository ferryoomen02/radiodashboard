/**
 * Synchroon (vóór type=module) laatst bekende sidebar-HTML terugzetten bij MPA-navigatie.
 * Voorkomt een lege menulijst tussen pageload en sidebar.js.
 *
 * Moet direct na <aside id="sidebar-root"> worden geladen.
 */
(function () {
  var KEY = "sw_sidebar_html_v1";
  try {
    var html = sessionStorage.getItem(KEY);
    if (!html || html.length < 80) return;

    var raw = localStorage.getItem("portalAuth");
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!data || !data.token) return;

    var root = document.getElementById("sidebar-root");
    if (!root) return;

    if (root.querySelector("[data-sidebar-rail]")) return;

    root.innerHTML = html;
    root.classList.add("sidebar--ready");
    var rail = root.querySelector("[data-sidebar-rail]");
    if (rail) rail.classList.add("sidebar-rail--visible");
    root.dataset.sidebarRestored = "1";
    if (typeof window !== "undefined" && window.swSyncSidebarActiveFromRoute) {
      window.swSyncSidebarActiveFromRoute();
    }
  } catch (e) {
    /* ignore */
  }
})();
