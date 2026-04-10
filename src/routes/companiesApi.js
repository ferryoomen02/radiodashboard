import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role } from "../constants/roles.js";
import { asyncHandler } from "../asyncHandler.js";
import { slugify } from "../lib/slug.js";

export const companiesRouter = Router();
companiesRouter.use(requireAuth);
companiesRouter.use(requireRoles(Role.SUPER_ADMIN));

companiesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const list = await prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stations: true } } },
    });
    return res.json({
      companies: list.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        metadata: c.metadata,
        stationCount: c._count.stations,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  })
);

companiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    let slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
    if (!name) {
      return res.status(400).json({ error: "Naam is verplicht." });
    }
    slug = slug ? slugify(slug) : slugify(name);
    const exists = await prisma.company.findUnique({ where: { slug } });
    if (exists) {
      return res.status(400).json({ error: "Deze slug bestaat al. Kies een andere naam of slug." });
    }
    const metadata =
      req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {};
    const c = await prisma.company.create({
      data: { name, slug, metadata },
    });
    return res.status(201).json(c);
  })
);

companiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const c = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { stations: true } } },
    });
    if (!c) {
      return res.status(404).json({ error: "Bedrijf niet gevonden." });
    }
    return res.json({
      id: c.id,
      name: c.name,
      slug: c.slug,
      metadata: c.metadata,
      stationCount: c._count.stations,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  })
);

companiesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Bedrijf niet gevonden." });
    }
    const data = {};
    if (typeof req.body?.name === "string") {
      const n = req.body.name.trim();
      if (!n) return res.status(400).json({ error: "Naam mag niet leeg zijn." });
      data.name = n;
    }
    if (typeof req.body?.slug === "string") {
      const s = slugify(req.body.slug);
      if (!s) return res.status(400).json({ error: "Slug ongeldig." });
      const clash = await prisma.company.findFirst({ where: { slug: s, NOT: { id } } });
      if (clash) return res.status(400).json({ error: "Deze slug is al in gebruik." });
      data.slug = s;
    }
    if (req.body?.metadata !== undefined) {
      if (typeof req.body.metadata !== "object" || req.body.metadata === null || Array.isArray(req.body.metadata)) {
        return res.status(400).json({ error: "metadata moet een object zijn." });
      }
      data.metadata = req.body.metadata;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Geen velden om bij te werken." });
    }
    const updated = await prisma.company.update({ where: { id }, data });
    return res.json(updated);
  })
);

companiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const n = await prisma.station.count({ where: { companyId: req.params.id } });
    if (n > 0) {
      return res.status(400).json({
        error: "Dit bedrijf heeft nog zenders. Verplaats of verwijder die eerst.",
      });
    }
    await prisma.company.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  })
);
