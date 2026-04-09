import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { fetchActiveFeatures } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";
import { redirectNoModuleAccess } from "./portal-routing.js";

const key = document.body.dataset.featureKey;
if (!key) {
  console.error("feature-placeholder-page: data-feature-key ontbreekt");
}

(async () => {
  await refreshAuthProfile();
  const auth = getAuth();
  if (!auth?.token) {
    window.location.href = "/login";
    return;
  }
  if (isSuperAdminRole(auth.user?.role)) {
    return;
  }
  const feats = await fetchActiveFeatures(true, {
    role: auth.user?.role,
    from: "feature-placeholder",
  });
  if (!feats?.enabledKeys?.has(key)) {
    redirectNoModuleAccess(`placeholder: geen module ${key}`);
  }
})();
