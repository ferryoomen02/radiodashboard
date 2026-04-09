import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { isSuperAdmin, isStationAdmin, isStaff } from "../constants/roles.js";
import {
  attachEffectiveStation,
  requireEffectiveStation,
  enforceStationScope,
} from "../middleware/stationContext.js";
import { requireStationFeatures } from "../middleware/requireStationFeature.js";
import { asyncHandler } from "../asyncHandler.js";
import { FEATURE_KEYS } from "../constants/featureKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const uploadsRoot = path.join(projectRoot, "uploads");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function randomName(original) {
  const ext = path.extname(original || "") || ".bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

function isImageMime(m) {
  return typeof m === "string" && m.startsWith("image/");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!isImageMime(file.mimetype)) {
      return cb(new Error("Alleen afbeeldingen zijn toegestaan."));
    }
    cb(null, true);
  },
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

mediaRouter.get(
  "/",
  attachEffectiveStation,
  requireEffectiveStation,
  enforceStationScope,
  requireStationFeatures(FEATURE_KEYS.MEDIA),
  asyncHandler(async (req, res) => {
    const stationId = req.effectiveStationId;
    const items = await prisma.mediaAsset.findMany({
      where: { stationId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        width: true,
        height: true,
        title: true,
        altText: true,
        createdAt: true,
        storageKey: true,
      },
    });
    return res.json({
      items: items.map((m) => ({
        ...m,
        url: `/api/media/${encodeURIComponent(m.id)}/file`,
      })),
    });
  })
);

mediaRouter.post(
  "/upload",
  upload.single("file"),
  attachEffectiveStation,
  requireEffectiveStation,
  enforceStationScope,
  requireStationFeatures(FEATURE_KEYS.MEDIA),
  asyncHandler(async (req, res) => {
    const stationId = req.effectiveStationId;
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: "Geen bestand." });
    }

    const dir = path.join(uploadsRoot, stationId);
    ensureDir(dir);
    const filename = randomName(file.originalname);
    const abs = path.join(dir, filename);
    fs.writeFileSync(abs, file.buffer);

    const relKey = path.relative(uploadsRoot, abs).split(path.sep).join("/");

    const asset = await prisma.mediaAsset.create({
      data: {
        stationId,
        filename: file.originalname || filename,
        storageKey: relKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      id: asset.id,
      filename: asset.filename,
      url: `/api/media/${encodeURIComponent(asset.id)}/file`,
    });
  })
);

mediaRouter.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).end();
    }

    const { user } = req;
    let allowed = false;
    if (isSuperAdmin(user)) {
      allowed = true;
    } else if ((isStationAdmin(user) || isStaff(user)) && user.stationId === asset.stationId) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).end();
    }

    const abs = path.join(uploadsRoot, asset.storageKey);
    if (!abs.startsWith(uploadsRoot) || !fs.existsSync(abs)) {
      return res.status(404).end();
    }

    res.type(asset.mimeType);
    res.sendFile(abs);
  })
);

mediaRouter.delete(
  "/:id",
  attachEffectiveStation,
  requireEffectiveStation,
  enforceStationScope,
  requireStationFeatures(FEATURE_KEYS.MEDIA),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const stationId = req.effectiveStationId;

    const asset = await prisma.mediaAsset.findFirst({
      where: { id, stationId },
    });
    if (!asset) {
      return res.status(404).json({ error: "Niet gevonden." });
    }

    if (isStaff(req.user)) {
      return res.status(403).json({ error: "Alleen station admin of super mag verwijderen." });
    }

    const abs = path.join(uploadsRoot, asset.storageKey);
    await prisma.mediaAsset.delete({ where: { id } });
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }

    return res.json({ ok: true });
  })
);
