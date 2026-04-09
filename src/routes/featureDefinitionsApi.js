import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role } from "../constants/roles.js";
import { normalizeEnabledFeatures } from "../lib/featureService.js";
import { asyncHandler } from "../asyncHandler.js";

export const featureDefinitionsRouter = Router();
featureDefinitionsRouter.use(requireAuth);
featureDefinitionsRouter.use(requireRoles(Role.SUPER_ADMIN));

featureDefinitionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const defs = await prisma.featureDefinition.findMany({
      orderBy: { key: "asc" },
    });
    return res.json({ definitions: defs });
  })
);

featureDefinitionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const key =
      typeof req.body?.key === "string"
        ? req.body.key
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_")
        : "";
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : null;
    if (!key || !label) {
      return res.status(400).json({ error: "Vul key en label in (key: alleen letters, cijfers, _, -)." });
    }
    const existing = await prisma.featureDefinition.findUnique({ where: { key } });
    if (existing) {
      return res.status(400).json({ error: "Deze feature-key bestaat al." });
    }
    const created = await prisma.featureDefinition.create({
      data: {
        key,
        label,
        description: description || null,
        isBuiltIn: false,
      },
    });
    return res.status(201).json(created);
  })
);

featureDefinitionsRouter.delete(
  "/:key",
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    const def = await prisma.featureDefinition.findUnique({ where: { key } });
    if (!def) {
      return res.status(404).json({ error: "Feature niet gevonden." });
    }
    if (def.isBuiltIn) {
      return res.status(400).json({ error: "Ingebouwde features kun je niet verwijderen." });
    }
    await prisma.featureDefinition.delete({ where: { key } });
    const stations = await prisma.station.findMany({ select: { id: true, enabledFeatures: true } });
    for (const s of stations) {
      const arr = normalizeEnabledFeatures(s.enabledFeatures).filter((k) => k !== key);
      await prisma.station.update({
        where: { id: s.id },
        data: { enabledFeatures: arr },
      });
    }
    return res.json({ ok: true });
  })
);
