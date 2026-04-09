import { prisma } from "../db.js";

export function normalizeEnabledFeatures(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x) => typeof x === "string" && x.length > 0);
  }
  return [];
}

export async function stationHasAllFeatures(stationId, keys) {
  if (!stationId || !keys?.length) return true;
  const s = await prisma.station.findUnique({
    where: { id: stationId },
    select: { enabledFeatures: true },
  });
  const enabled = normalizeEnabledFeatures(s?.enabledFeatures);
  return keys.every((k) => enabled.includes(k));
}

export async function stationHasFeature(stationId, key) {
  return stationHasAllFeatures(stationId, [key]);
}
