import { getAuth, isSuperAdminRole } from "./portal-auth.js";
import { fetchActiveFeatures } from "./portal-features.js";
import { refreshAuthProfile } from "./auth-refresh.js";

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
  const feats = await fetchActiveFeatures(true);
  if (!feats?.enabledKeys?.has(key)) {
    window.location.href = "/account";
  }
})();
