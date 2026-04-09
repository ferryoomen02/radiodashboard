import { getAuth } from "./portal-auth.js";
import { fetchActiveFeatures } from "./portal-features.js";

const key = document.body.dataset.featureKey;
if (!key) {
  console.error("feature-placeholder-page: data-feature-key ontbreekt");
}

const auth = getAuth();
if (!auth?.token) {
  window.location.href = "/login";
}

(async () => {
  const feats = await fetchActiveFeatures();
  if (!feats?.enabledKeys?.has(key)) {
    window.location.href = "/account";
  }
})();
