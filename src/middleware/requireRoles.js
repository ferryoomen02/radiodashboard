/**
 * @param {...string} allowed - Role-waarden (bijv. Role.SUPER_ADMIN)
 */
export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Niet ingelogd." });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Geen rechten voor deze actie." });
    }
    next();
  };
}
