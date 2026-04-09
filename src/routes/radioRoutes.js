import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  attachEffectiveStation,
  requireEffectiveStation,
  enforceStationScope,
} from "../middleware/stationContext.js";
import { asyncHandler } from "../asyncHandler.js";

export const radioRouter = Router();

radioRouter.use(requireAuth);
radioRouter.use(attachEffectiveStation);
radioRouter.use(requireEffectiveStation);
radioRouter.use(enforceStationScope);

/** Overzicht van gekozen station + nu speelt + geschiedenis */
radioRouter.get(
  "/radio",
  asyncHandler(async (req, res) => {
    const stationId = req.effectiveStationId;

    const station = await prisma.station.findUnique({
      where: { id: stationId },
    });
    if (!station) {
      return res.status(404).json({ error: "Station niet gevonden." });
    }

    let nowPlaying = null;
    if (station.currentTrackId) {
      nowPlaying = await prisma.track.findFirst({
        where: { id: station.currentTrackId, stationId },
      });
    }

    const history = await prisma.playHistory.findMany({
      where: { stationId },
      orderBy: { playedAt: "desc" },
      take: 10,
      include: { track: true },
    });

    const trackCount = await prisma.track.count({
      where: { stationId },
    });

    return res.json({
      station: {
        id: station.id,
        name: station.name,
        description: station.description,
        trackCount,
      },
      nowPlaying,
      history: history.map((h) => ({
        playedAt: h.playedAt,
        track: h.track,
      })),
    });
  })
);

radioRouter.post(
  "/tracks",
  asyncHandler(async (req, res) => {
    const artist = typeof req.body?.artist === "string" ? req.body.artist.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const durationRaw = req.body?.durationSeconds;
    const stationId = req.effectiveStationId;

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

radioRouter.get(
  "/now-playing",
  asyncHandler(async (req, res) => {
    const stationId = req.effectiveStationId;
    const station = await prisma.station.findUnique({
      where: { id: stationId },
    });
    if (!station?.currentTrackId) {
      return res.json({ track: null, message: "Er speelt nu niets." });
    }
    const track = await prisma.track.findFirst({
      where: { id: station.currentTrackId, stationId },
    });
    if (!track) {
      return res.json({ track: null, message: "Er speelt nu niets (track ontbreekt)." });
    }
    return res.json({ track, message: "Nu speelt dit nummer." });
  })
);

radioRouter.get(
  "/playlist",
  asyncHandler(async (req, res) => {
    const stationId = req.effectiveStationId;
    let limit = parseInt(String(req.query.limit ?? "20"), 10);
    if (Number.isNaN(limit)) limit = 20;
    limit = Math.min(Math.max(limit, 1), 100);

    const rows = await prisma.playHistory.findMany({
      where: { stationId },
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
