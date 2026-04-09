import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role, isSuperAdmin, isStationAdmin } from "../constants/roles.js";
import { DEFAULT_STATION_FEATURES, FEATURE_LABELS } from "../constants/featureKeys.js";
import { normalizeEnabledFeatures } from "../lib/featureService.js";
import { requireUserStationFeature } from "../middleware/requireStationFeature.js";
import { asyncHandler } from "../asyncHandler.js";

export const stationsRouter = Router();
stationsRouter.use(requireAuth);
stationsRouter.use((req, res, next) => {
  if (isSuperAdmin(req.user)) return next();
  return requireUserStationFeature("stations")(req, res, next);
});

stationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { user } = req;
    if (isSuperAdmin(user)) {
      const stations = await prisma.station.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true, tracks: true } },
        },
      });
      return res.json({
        stations: stations.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          userCount: s._count.users,
          trackCount: s._count.tracks,
          enabledFeatures: normalizeEnabledFeatures(s.enabledFeatures),
        })),
      });
    }
    if (isStationAdmin(user) && user.stationId) {
      const s = await prisma.station.findUnique({
        where: { id: user.stationId },
        include: {
          _count: { select: { users: true, tracks: true } },
        },
      });
      return res.json({
        stations: s
          ? [
              {
                id: s.id,
                name: s.name,
                description: s.description,
                userCount: s._count.users,
                trackCount: s._count.tracks,
                enabledFeatures: normalizeEnabledFeatures(s.enabledFeatures),
              },
            ]
          : [],
      });
    }
    return res.status(403).json({ error: "Geen toegang tot zenders." });
  })
);

stationsRouter.post(
  "/",
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : null;
    if (!name) {
      return res.status(400).json({ error: "Naam is verplicht." });
    }
    const station = await prisma.station.create({
      data: {
        name,
        description: description || null,
        enabledFeatures: DEFAULT_STATION_FEATURES,
      },
    });
    return res.status(201).json(station);
  })
);

/** Bestaande gebruiker (e-mail) als station admin aan een zender koppelen. */
stationsRouter.post(
  "/assign-admin",
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const stationId = typeof req.body?.stationId === "string" ? req.body.stationId.trim() : "";
    if (!email || !stationId) {
      return res.status(400).json({ error: "E-mail en stationId zijn verplicht." });
    }
    const station = await prisma.station.findUnique({ where: { id: stationId } });
    if (!station) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }
    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) {
      return res.status(404).json({ error: "Geen gebruiker met dit e-mailadres." });
    }
    if (target.role === Role.SUPER_ADMIN) {
      return res.status(400).json({ error: "Kan geen super admin als station admin koppelen." });
    }
    await prisma.user.update({
      where: { id: target.id },
      data: {
        role: Role.STATION_ADMIN,
        stationId,
        permissions: [],
      },
    });
    return res.json({ ok: true, message: "Station admin gekoppeld." });
  })
);

stationsRouter.get(
  "/:id/features",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { user } = req;
    if (!isSuperAdmin(user) && (!isStationAdmin(user) || user.stationId !== id)) {
      return res.status(403).json({ error: "Geen toegang." });
    }
    const station = await prisma.station.findUnique({
      where: { id },
      select: { id: true, name: true, enabledFeatures: true },
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
      stationName: station.name,
      enabledKeys,
      definitions: defs,
      labelByKey,
    });
  })
);

stationsRouter.put(
  "/:id/features",
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const keysRaw = req.body?.enabledFeatureKeys ?? req.body?.keys;
    if (!Array.isArray(keysRaw)) {
      return res.status(400).json({ error: "Body moet enabledFeatureKeys: string[] bevatten." });
    }
    const enabledFeatureKeys = keysRaw.filter((k) => typeof k === "string" && k.trim().length > 0);
    const station = await prisma.station.findUnique({ where: { id } });
    if (!station) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }
    const updated = await prisma.station.update({
      where: { id },
      data: { enabledFeatures: enabledFeatureKeys },
    });
    return res.json({
      id: updated.id,
      enabledFeatures: normalizeEnabledFeatures(updated.enabledFeatures),
    });
  })
);

stationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { user } = req;

    if (isSuperAdmin(user)) {
      // ok
    } else if (isStationAdmin(user) && user.stationId === id) {
      // ok
    } else {
      return res.status(403).json({ error: "Geen rechten om deze zender te wijzigen." });
    }

    const station = await prisma.station.findUnique({ where: { id } });
    if (!station) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }

    const nameRaw = req.body?.name;
    const descRaw = req.body?.description;
    const data = {};

    if (typeof nameRaw === "string") {
      const n = nameRaw.trim();
      if (!n) return res.status(400).json({ error: "Naam mag niet leeg zijn." });
      data.name = n;
    }
    if (descRaw !== undefined) {
      data.description =
        typeof descRaw === "string" && descRaw.trim() ? descRaw.trim() : null;
    }

    if (req.body?.enabledFeatures !== undefined) {
      if (!isSuperAdmin(user)) {
        return res.status(403).json({ error: "Alleen super admins kunnen functies per zender wijzigen." });
      }
      const arr = Array.isArray(req.body.enabledFeatures)
        ? req.body.enabledFeatures.filter((k) => typeof k === "string")
        : null;
      if (!arr) {
        return res.status(400).json({ error: "enabledFeatures moet een array van strings zijn." });
      }
      data.enabledFeatures = arr;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Geen velden om bij te werken." });
    }

    const updated = await prisma.station.update({
      where: { id },
      data,
    });
    return res.json(updated);
  })
);
