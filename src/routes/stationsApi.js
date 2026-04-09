import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role, isSuperAdmin, isStationAdmin } from "../constants/roles.js";
import { asyncHandler } from "../asyncHandler.js";

export const stationsRouter = Router();
stationsRouter.use(requireAuth);

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
      },
    });
    return res.status(201).json(station);
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
