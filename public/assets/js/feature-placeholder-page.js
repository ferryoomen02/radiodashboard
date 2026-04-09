import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { ensurePageSession } from "./portal-session.js";
import { redirectNoModuleAccess } from "./portal-routing.js";

const key = document.body.dataset.featureKey;
if (!key) {
  console.error("feature-placeholder-page: data-feature-key ontbreekt");
}

(async () => {
  const session = await ensurePageSession();
  const auth = session.auth || getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (isSuperAdminRole(auth.user?.role)) {
    return;
  }
  const feats = session.features;
  if (!feats?.enabledKeys?.has(key)) {
    redirectNoModuleAccess(`placeholder: geen module ${key}`);
  }
})();
