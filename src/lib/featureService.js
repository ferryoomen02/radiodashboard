import { getEnabledFeatureKeysForStation } from "./stationFeatureStore.js";

export { normalizeEnabledFeatures } from "./featureNormalize.js";

export async function stationHasAllFeatures(stationId, keys) {
  if (!stationId || !keys?.length) return true;
  const enabled = await getEnabledFeatureKeysForStation(stationId);
  return keys.every((k) => enabled.includes(k));
}

export async function stationHasFeature(stationId, key) {
  return stationHasAllFeatures(stationId, [key]);
}
