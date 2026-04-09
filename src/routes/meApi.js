import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isSuperAdmin } from "../constants/roles.js";
import { DEFAULT_STATION_FEATURES, FEATURE_LABELS } from "../constants/featureKeys.js";
import { normalizeEnabledFeatures } from "../lib/featureService.js";
import { asyncHandler } from "../asyncHandler.js";

export const meRouter = Router();
meRouter.use(requireAuth);

/**
 * Welke feature-keys staan aan voor de gekozen zender (sidebar + client guards).
 * Query stationId: verplicht voor super admin; anderen gebruiken eigen stationId.
 */
meRouter.get(
  "/active-features",
  asyncHandler(async (req, res) => {
    let stationId = typeof req.query.stationId === "string" ? req.query.stationId.trim() : null;
    if (isSuperAdmin(req.user)) {
      if (!stationId) {
        const defs = await prisma.featureDefinition.findMany({ orderBy: { key: "asc" } });
        const labelByKey = { ...FEATURE_LABELS };
        for (const d of defs) {
          labelByKey[d.key] = d.label;
        }
        return res.json({
          stationId: null,
          enabledKeys: DEFAULT_STATION_FEATURES,
          definitions: defs,
          labelByKey,
        });
      }
    } else {
      stationId = req.user.stationId;
      if (!stationId) {
        return res.json({
          stationId: null,
          enabledKeys: [],
          definitions: [],
          labelByKey: {},
        });
      }
    }

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { id: true, enabledFeatures: true },
    });
    if (!station) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }

    const enabledKeys = normalizeEnabledFeatures(station.enabledFeatures);
    const defs = await prisma.featureDefinition.findMany({ orderBy: { key: "asc" } });

    const labelByKey = { ...FEATURE_LABELS };
    for (const d of defs) {
      labelByKey[d.key] = d.label;
    }

    return res.json({
      stationId: station.id,
      enabledKeys,
      definitions: defs,
      labelByKey,
    });
  })
);
