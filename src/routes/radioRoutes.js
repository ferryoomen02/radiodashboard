import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../asyncHandler.js";

export const radioRouter = Router();

radioRouter.use(requireAuth);

/**
 * Nieuw nummer toevoegen aan jouw station.
 * Het nieuwe nummer wordt meteen “nu speelt”.
 * Het vorige nummer (als die er was) gaat naar de playlist-geschiedenis.
 */
radioRouter.post(
  "/tracks",
  asyncHandler(async (req, res) => {
  const artist = typeof req.body?.artist === "string" ? req.body.artist.trim() : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const durationRaw = req.body?.durationSeconds;

  if (!artist || !title) {
    return res.status(400).json({ error: "Vul artist en title in." });
  }

  let durationSeconds = null;
  if (durationRaw !== undefined && durationRaw !== null && durationRaw !== "") {
    const n = Number(durationRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return res.status(400).json({
        error: "durationSeconds moet een geheel getal >= 0 zijn (of weglaten).",
      });
    }
    durationSeconds = n;
  }

  const stationId = req.stationId;

  const track = await prisma.$transaction(async (tx) => {
    const station = await tx.station.findUnique({ where: { id: stationId } });
    if (!station) {
      throw new Error("Station niet gevonden");
    }
    if (station.currentTrackId) {
      await tx.playHistory.create({
        data: {
          stationId,
          trackId: station.currentTrackId,
        },
      });
    }
    const created = await tx.track.create({
      data: {
        stationId,
        artist,
        title,
        durationSeconds,
      },
    });
    await tx.station.update({
      where: { id: stationId },
      data: { currentTrackId: created.id },
    });
    return created;
  });

  return res.status(201).json(track);
  })
);

/** Huidige “nu speelt” voor jouw station. */
radioRouter.get(
  "/now-playing",
  asyncHandler(async (req, res) => {
  const station = await prisma.station.findUnique({
    where: { id: req.stationId },
  });
  if (!station?.currentTrackId) {
    return res.json({ track: null, message: "Er speelt nu niets." });
  }
  const track = await prisma.track.findFirst({
    where: { id: station.currentTrackId, stationId: req.stationId },
  });
  if (!track) {
    return res.json({ track: null, message: "Er speelt nu niets (track ontbreekt)." });
  }
  return res.json({ track, message: "Nu speelt dit nummer." });
  })
);

/**
 * Laatst gespeelde nummers (geschiedenis), nieuwste eerst.
 * Query: ?limit=20 (max 100)
 */
radioRouter.get(
  "/playlist",
  asyncHandler(async (req, res) => {
  let limit = parseInt(String(req.query.limit ?? "20"), 10);
  if (Number.isNaN(limit)) limit = 20;
  limit = Math.min(Math.max(limit, 1), 100);

  const rows = await prisma.playHistory.findMany({
    where: { stationId: req.stationId },
    orderBy: { playedAt: "desc" },
    take: limit,
    include: { track: true },
  });

  return res.json({
    items: rows.map((r) => ({
      playedAt: r.playedAt,
      track: r.track,
    })),
  });
  })
);
