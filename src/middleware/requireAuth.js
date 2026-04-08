import { prisma } from "../db.js";
import { verifyToken } from "../authTokens.js";

/**
 * Verwacht header: Authorization: Bearer <token>
 * Hangt req.user en req.stationId aan voor de route-handlers.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error:
        "Log in en stuur de header Authorization: Bearer <token> (token krijg je bij POST /auth/login).",
    });
  }
  const token = header.slice("Bearer ".length).trim();
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Ongeldig of verlopen token." });
  }
  prisma.user
    .findUnique({
      where: { id: userId },
      include: { station: true },
    })
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Gebruiker niet gevonden." });
      }
      req.user = user;
      req.stationId = user.stationId;
      next();
    })
    .catch(next);
}
