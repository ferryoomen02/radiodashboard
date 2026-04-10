import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role, isSuperAdmin, isStationAdmin } from "../constants/roles.js";
import { DEFAULT_STATION_FEATURES, FEATURE_LABELS } from "../constants/featureKeys.js";
import { normalizeEnabledFeatures } from "../lib/featureService.js";
import {
  getEnabledFeatureKeysForStation,
  replaceStationFeatureKeys,
} from "../lib/stationFeatureStore.js";
import { requireUserStationFeature } from "../middleware/requireStationFeature.js";
import { asyncHandler } from "../asyncHandler.js";
import { slugify } from "../lib/slug.js";

export const stationsRouter = Router();
stationsRouter.use(requireAuth);
stationsRouter.use((req, res, next) => {
  if (isSuperAdmin(req.user)) return next();
  return requireUserStationFeature("stations")(req, res, next);
});

function stationListItem(s) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    status: s.status,
    description: s.description,
    companyId: s.companyId,
    company: s.company
      ? { id: s.company.id, name: s.company.name, slug: s.company.slug }
      : null,
    userCount: s._count?.users ?? 0,
    trackCount: s._count?.tracks ?? 0,
    enabledFeatures: normalizeEnabledFeatures(s.enabledFeatures),
  };
}

stationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { user } = req;
    if (isSuperAdmin(user)) {
      const stations = await prisma.station.findMany({
        orderBy: { name: "asc" },
        include: {
          company: { select: { id: true, name: true, slug: true } },
          _count: { select: { users: true, tracks: true } },
        },
      });
      return res.json({
        stations: stations.map(stationListItem),
      });
    }
    if (isStationAdmin(user) && user.stationId) {
      const s = await prisma.station.findUnique({
        where: { id: user.stationId },
        include: {
          company: { select: { id: true, name: true, slug: true } },
          _count: { select: { users: true, tracks: true } },
        },
      });
      return res.json({
        stations: s ? [stationListItem(s)] : [],
      });
    }
    return res.status(403).json({ error: "Geen toegang tot zenders." });
  })
);

stationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { user } = req;
    if (!isSuperAdmin(user) && (!isStationAdmin(user) || user.stationId !== id)) {
      return res.status(403).json({ error: "Geen toegang." });
    }
    const s = await prisma.station.findUnique({
      where: { id },
      include: {
        company: true,
        _count: { select: { users: true, tracks: true } },
      },
    });
    if (!s) {
      return res.status(404).json({ error: "Zender niet gevonden." });
    }
    const enabledKeys = await getEnabledFeatureKeysForStation(id);
    return res.json({
      ...stationListItem(s),
      enabledFeatureKeys: enabledKeys,
    });
  })
);

stationsRouter.post(
  "/",
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const companyId = typeof req.body?.companyId === "string" ? req.body.companyId.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    let slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : null;
    const statusRaw = req.body?.status;
    if (!companyId || !name) {
      return res.status(400).json({ error: "companyId en naam zijn verplicht." });
    }
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(400).json({ error: "Bedrijf niet gevonden." });
    }
    slug = slug ? slugify(slug) : slugify(name);
    const slugTaken = await prisma.station.findUnique({ where: { slug } });
    if (slugTaken) {
      return res.status(400).json({ error: "Deze zender-slug bestaat al." });
    }
    let status = "ACTIVE";
    if (typeof statusRaw === "string" && ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(statusRaw)) {
      status = statusRaw;
    }

    const station = await prisma.$transaction(async (tx) => {
      const st = await tx.station.create({
        data: {
          companyId,
          name,
          slug,
          description: description || null,
          status,
          enabledFeatures: [],
        },
      });
      await replaceStationFeatureKeys(st.id, DEFAULT_STATION_FEATURES, tx);
      return st;
    });

    const full = await prisma.station.findUnique({
      where: { id: station.id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { users: true, tracks: true } },
      },
    });
    return res.status(201).json(stationListItem(full));
  })
);

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
    const enabledKeys = await getEnabledFeatureKeysForStation(id);
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
    const unique = await replaceStationFeatureKeys(id, enabledFeatureKeys);
    return res.json({
      id,
      enabledFeatures: unique,
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

    if (isSuperAdmin(user)) {
      if (typeof req.body?.slug === "string") {
        const s = slugify(req.body.slug);
        if (!s) return res.status(400).json({ error: "Slug ongeldig." });
        const clash = await prisma.station.findFirst({ where: { slug: s, NOT: { id } } });
        if (clash) return res.status(400).json({ error: "Deze slug is al in gebruik." });
        data.slug = s;
      }
      if (typeof req.body?.companyId === "string") {
        const cid = req.body.companyId.trim();
        const c = await prisma.company.findUnique({ where: { id: cid } });
        if (!c) return res.status(400).json({ error: "Bedrijf niet gevonden." });
        data.companyId = cid;
      }
      if (req.body?.status !== undefined) {
        const st = req.body.status;
        if (!["ACTIVE", "INACTIVE", "ARCHIVED"].includes(st)) {
          return res.status(400).json({ error: "status moet ACTIVE, INACTIVE of ARCHIVED zijn." });
        }
        data.status = st;
      }
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
      await replaceStationFeatureKeys(id, arr);
    }

    if (Object.keys(data).length === 0 && req.body?.enabledFeatures === undefined) {
      return res.status(400).json({ error: "Geen velden om bij te werken." });
    }

    if (Object.keys(data).length > 0) {
      await prisma.station.update({
        where: { id },
        data,
      });
    }

    const full = await prisma.station.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { users: true, tracks: true } },
      },
    });
    return res.json(stationListItem(full));
  })
);
