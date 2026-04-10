import { prisma } from "../db.js";
import { getEnabledFeatureKeysForStation } from "./stationFeatureStore.js";

/**
 * @param {string | null | undefined} slug
 * @returns {Promise<import("@prisma/client").Station | null>}
 */
export async function findActiveStationByPublicSlug(slug) {
  if (!slug || typeof slug !== "string") return null;
  return prisma.station.findFirst({
    where: {
      slug: slug.trim().toLowerCase(),
      status: "ACTIVE",
    },
  });
}

/**
 * Publieke payload voor homepage / login / dashboard thema.
 */
export async function buildPublicStationPayload(station) {
  const enabledKeys = await getEnabledFeatureKeysForStation(station.id);
  return {
    id: station.id,
    name: station.name,
    slug: station.slug,
    description: station.description,
    logoUrl: station.publicLogoUrl,
    primaryColor: station.primaryColor || "#1e293b",
    accentColor: station.accentColor || "#da2e20",
    enabledFeatures: enabledKeys,
  };
}
