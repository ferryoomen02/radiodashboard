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
 * Super admin krijgt altijd de volledige catalogus voor navigatie (ongeacht station.enabledFeatures),
 * zodat beheer nooit “verdwijnt” door lege of oude JSON op een zender.
 */
meRouter.get(
  "/active-features",
  asyncHandler(async (req, res) => {
    const stationIdParam =
      typeof req.query.stationId === "string" ? req.query.stationId.trim() : null;

    const defs = await prisma.featureDefinition.findMany({ orderBy: { key: "asc" } });
    const labelByKey = { ...FEATURE_LABELS };
    for (const d of defs) {
      labelByKey[d.key] = d.label;
    }

    if (isSuperAdmin(req.user)) {
      let responseStationId = null;
      if (stationIdParam) {
        const st = await prisma.station.findUnique({
          where: { id: stationIdParam },
          select: { id: true },
        });
        if (!st) {
          return res.status(404).json({ error: "Zender niet gevonden." });
        }
        responseStationId = st.id;
      }
      return res.json({
        stationId: responseStationId,
        enabledKeys: DEFAULT_STATION_FEATURES,
        definitions: defs,
        labelByKey,
      });
    }

    const stationId = req.user.stationId;
    if (!stationId) {
      return res.json({
        stationId: null,
        enabledKeys: [],
        definitions: [],
        labelByKey: {},
      });
    }

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { id: true, enabledFeatures: true },
    });
    if (!station) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }

    let enabledKeys = normalizeEnabledFeatures(station.enabledFeatures);

    if (!isStationAdmin(req.user)) {
      const perms = normalizePermissions(req.user.permissions);
      enabledKeys = enabledKeys.filter((k) => perms.includes(k));
    }

    return res.json({
      stationId: station.id,
      enabledKeys,
      definitions: defs,
      labelByKey,
    });
  })
);
