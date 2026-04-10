/**
 * URL-veilige slug (kleine letters, cijfers, koppeltekens).
 */
export function slugify(input) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}
