import { prisma } from "../db.js";
import { normalizeEnabledFeatures } from "./featureNormalize.js";

/**
 * Bron: StationFeature-rijen; fallback op enabledFeatures JSON bij lege join (migratie/overgang).
 */
export async function getEnabledFeatureKeysForStation(stationId) {
  if (!stationId) return [];
  const rows = await prisma.stationFeature.findMany({
    where: { stationId },
    select: { featureKey: true },
    orderBy: { featureKey: "asc" },
  });
  if (rows.length > 0) {
    return rows.map((r) => r.featureKey);
  }
  const s = await prisma.station.findUnique({
    where: { id: stationId },
    select: { enabledFeatures: true },
  });
  return normalizeEnabledFeatures(s?.enabledFeatures);
}

/**
 * Vervangt alle features voor een zender en werkt JSON-cache bij.
 * @param {import("@prisma/client").Prisma.TransactionClient} [tx]
 */
export async function replaceStationFeatureKeys(stationId, keys, tx = prisma) {
  const unique = [...new Set((keys || []).filter((k) => typeof k === "string" && k.trim().length > 0))];
  await tx.stationFeature.deleteMany({ where: { stationId } });
  if (unique.length > 0) {
    await tx.stationFeature.createMany({
      data: unique.map((featureKey) => ({ stationId, featureKey })),
      skipDuplicates: true,
    });
  }
  await tx.station.update({
    where: { id: stationId },
    data: { enabledFeatures: unique },
  });
  return unique;
}
