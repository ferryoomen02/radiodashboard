import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isSuperAdmin, isStationAdmin } from "../constants/roles.js";
import { DEFAULT_STATION_FEATURES, FEATURE_LABELS } from "../constants/featureKeys.js";
import { normalizeEnabledFeatures } from "../lib/featureService.js";
import { normalizePermissions } from "../lib/permissions.js";
import { asyncHandler } from "../asyncHandler.js";

export const meRouter = Router();
meRouter.use(requireAuth);

/**
 * Effectieve feature-keys voor sidebar: station-modules doorsneden met gebruikersrechten (staff).
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

    let enabledKeys = normalizeEnabledFeatures(station.enabledFeatures);

    if (!isSuperAdmin(req.user) && !isStationAdmin(req.user)) {
      const perms = normalizePermissions(req.user.permissions);
      enabledKeys = enabledKeys.filter((k) => perms.includes(k));
    }

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
