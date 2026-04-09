import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role } from "../constants/roles.js";
import { asyncHandler } from "../asyncHandler.js";
import { mergeTexts, serializePlatformSettings } from "../lib/platformSettings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const uploadsRoot = path.join(projectRoot, "uploads");
const brandingDir = path.join(uploadsRoot, "branding");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function randomName(original) {
  const ext = path.extname(original || "") || ".png";
  return `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

function isImageMime(m) {
  return typeof m === "string" && m.startsWith("image/");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!isImageMime(file.mimetype)) {
      return cb(new Error("Alleen afbeeldingen zijn toegestaan."));
    }
    cb(null, true);
  },
});

export const platformSettingsRouter = Router();

platformSettingsRouter.get(
  "/platform-settings",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const row = await prisma.platformSettings.findUnique({ where: { id: "default" } });
    return res.json(serializePlatformSettings(row));
  })
);

platformSettingsRouter.patch(
  "/platform-settings",
  requireAuth,
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const current = await prisma.platformSettings.findUnique({ where: { id: "default" } });
    let nextTexts = mergeTexts(current?.texts);
    if (body.texts && typeof body.texts === "object" && !Array.isArray(body.texts)) {
      nextTexts = { ...nextTexts };
      if (typeof body.texts.dashboardWelcomeTitle === "string") {
        nextTexts.dashboardWelcomeTitle = body.texts.dashboardWelcomeTitle.trim().slice(0, 500);
      }
      if (typeof body.texts.dashboardWelcomeText === "string") {
        nextTexts.dashboardWelcomeText = body.texts.dashboardWelcomeText.trim().slice(0, 4000);
      }
    }

    const update = {};
    if (Object.prototype.hasOwnProperty.call(body, "platformName")) {
      update.platformName =
        typeof body.platformName === "string" && body.platformName.trim()
          ? body.platformName.trim().slice(0, 120)
          : "Portal";
    }
    if (Object.prototype.hasOwnProperty.call(body, "subtitle")) {
      update.subtitle =
        typeof body.subtitle === "string" ? body.subtitle.trim().slice(0, 120) : "";
    }
    if (body.texts && typeof body.texts === "object" && !Array.isArray(body.texts)) {
      update.texts = nextTexts;
    }

    const row = await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        platformName: update.platformName ?? "SonicWave",
        subtitle: update.subtitle ?? "Platform",
        texts: nextTexts,
      },
      update,
    });

    return res.json(serializePlatformSettings(row));
  })
);

platformSettingsRouter.post(
  "/platform-settings/logo",
  requireAuth,
  requireRoles(Role.SUPER_ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: "Geen bestand." });
    }

    ensureDir(brandingDir);
    const filename = randomName(file.originalname);
    const abs = path.join(brandingDir, filename);
    fs.writeFileSync(abs, file.buffer);

    const storageKey = path.relative(uploadsRoot, abs).split(path.sep).join("/");

    const prev = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { logoStorageKey: true },
    });
    if (prev?.logoStorageKey) {
      const oldAbs = path.join(uploadsRoot, prev.logoStorageKey);
      if (oldAbs.startsWith(uploadsRoot) && fs.existsSync(oldAbs)) {
        try {
          fs.unlinkSync(oldAbs);
        } catch {
          /* ignore */
        }
      }
    }

    const row = await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        logoStorageKey: storageKey,
      },
      update: { logoStorageKey: storageKey },
    });

    return res.json({
      ...serializePlatformSettings(row),
      message: "Logo opgeslagen.",
    });
  })
);

platformSettingsRouter.delete(
  "/platform-settings/logo",
  requireAuth,
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (_req, res) => {
    const prev = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { logoStorageKey: true },
    });
    if (prev?.logoStorageKey) {
      const oldAbs = path.join(uploadsRoot, prev.logoStorageKey);
      if (oldAbs.startsWith(uploadsRoot) && fs.existsSync(oldAbs)) {
        try {
          fs.unlinkSync(oldAbs);
        } catch {
          /* ignore */
        }
      }
    }
    const row = await prisma.platformSettings.update({
      where: { id: "default" },
      data: { logoStorageKey: null },
    });
    return res.json(serializePlatformSettings(row));
  })
);
