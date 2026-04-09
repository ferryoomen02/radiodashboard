/**
 * Standaard + merge voor API-responses en DB-upserts.
 * `texts` in DB: vrij uitbreidbaar object (bv. dashboardWelcomeTitle).
 */

export const DEFAULT_TEXTS = {
  dashboardWelcomeTitle: "",
  dashboardWelcomeText: "",
};

export function mergeTexts(raw) {
  const t =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : {};
  return { ...DEFAULT_TEXTS, ...t };
}

/**
 * @param {import("@prisma/client").PlatformSettings | null} row
 */
export function serializePlatformSettings(row) {
  const texts = mergeTexts(row?.texts);
  const logoStorageKey = row?.logoStorageKey?.trim() || null;
  return {
    platformName: row?.platformName?.trim() || "SonicWave",
    subtitle: row?.subtitle?.trim() || "Platform",
    logoUrl: logoStorageKey ? `/uploads/${logoStorageKey.split("/").map(encodeURIComponent).join("/")}` : null,
    logoStorageKey,
    texts,
  };
}
