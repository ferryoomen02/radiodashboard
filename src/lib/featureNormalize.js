/** @param {unknown} value */
export function normalizeEnabledFeatures(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x) => typeof x === "string" && x.length > 0);
  }
  return [];
}
