/**
 * URL-veilige slug (kleine letters, cijfers, koppeltekens; overige tekens weg).
 */
export function slugify(input) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}

/**
 * Unieke slug voor Station; bij botsing: naam-2, naam-3, …
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} nameOrBase
 * @param {string | null} [excludeStationId]
 */
export async function ensureUniqueStationSlug(prisma, nameOrBase, excludeStationId = null) {
  let base = slugify(nameOrBase);
  if (!base) base = "zender";
  for (let n = 0; n < 500; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const found = await prisma.station.findFirst({
      where: excludeStationId
        ? { slug: candidate, NOT: { id: excludeStationId } }
        : { slug: candidate },
      select: { id: true },
    });
    if (!found) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Unieke slug voor Company.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} nameOrBase
 * @param {string | null} [excludeCompanyId]
 */
export async function ensureUniqueCompanySlug(prisma, nameOrBase, excludeCompanyId = null) {
  let base = slugify(nameOrBase);
  if (!base) base = "bedrijf";
  for (let n = 0; n < 500; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const found = await prisma.company.findFirst({
      where: excludeCompanyId
        ? { slug: candidate, NOT: { id: excludeCompanyId } }
        : { slug: candidate },
      select: { id: true },
    });
    if (!found) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
