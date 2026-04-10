import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role, isSuperAdmin, isStationAdmin, isStaff } from "../constants/roles.js";
import { requireUserStationFeature } from "../middleware/requireStationFeature.js";
import { normalizePermissions } from "../lib/permissions.js";
import { FEATURE_KEYS } from "../constants/featureKeys.js";
import { asyncHandler } from "../asyncHandler.js";

export const usersRouter = Router();

const SALT_ROUNDS = 10;

const ALLOWED_PERMISSION_KEYS = new Set(Object.values(FEATURE_KEYS));

function sanitizePermissions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k) => typeof k === "string" && ALLOWED_PERMISSION_KEYS.has(k));
}

/** Super-only modules in station features; staff krijgt deze nooit als gebruikersrecht. */
const STAFF_BLOCKED_KEYS = new Set(["stations", "invites"]);

function sanitizeStaffPermissions(raw) {
  return sanitizePermissions(raw).filter((k) => !STAFF_BLOCKED_KEYS.has(k));
}

usersRouter.use(requireAuth);
usersRouter.use((req, res, next) => {
  if (isStationAdmin(req.user) && !req.user.stationId) {
    return res.status(403).json({ error: "Geen zender gekoppeld aan dit station-admin account." });
  }
  next();
});
usersRouter.use(requireRoles(Role.SUPER_ADMIN, Role.STATION_ADMIN));
usersRouter.use((req, res, next) => {
  if (isSuperAdmin(req.user)) return next();
  return requireUserStationFeature("users")(req, res, next);
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  stationId: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  station: { select: { id: true, name: true } },
};

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { user } = req;
    if (isSuperAdmin(user)) {
      const users = await prisma.user.findMany({
        select: userSelect,
        orderBy: { email: "asc" },
      });
      return res.json({ users });
    }
    if (isStationAdmin(user) && user.stationId) {
      const users = await prisma.user.findMany({
        where: { stationId: user.stationId },
        select: userSelect,
        orderBy: { email: "asc" },
      });
      return res.json({ users });
    }
    return res.status(403).json({ error: "Geen toegang." });
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { user: actor } = req;

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    let role = req.body?.role;
    let stationId = req.body?.stationId ?? null;
    let permissions = sanitizePermissions(req.body?.permissions);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Naam, e-mail en wachtwoord zijn verplicht." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Wachtwoord minimaal 6 tekens." });
    }

    if (isStationAdmin(actor)) {
      role = Role.STAFF;
      stationId = actor.stationId;
    } else if (isSuperAdmin(actor)) {
      if (!role) role = Role.STAFF;
      if (![Role.SUPER_ADMIN, Role.STATION_ADMIN, Role.STAFF].includes(role)) {
        return res.status(400).json({ error: "Ongeldige rol." });
      }
    }

    if (role !== Role.SUPER_ADMIN && !stationId) {
      return res.status(400).json({ error: "Koppel een zender (stationId) voor deze rol." });
    }
    if (role === Role.SUPER_ADMIN) {
      stationId = null;
    }

    if (isStationAdmin(actor) && stationId !== actor.stationId) {
      return res.status(403).json({ error: "Je mag alleen gebruikers op jouw zender aanmaken." });
    }

    if (isStationAdmin(actor) && role !== Role.STAFF) {
      return res.status(403).json({ error: "Alleen medewerkers (staff) aanmaken." });
    }

    if (role === Role.STAFF && permissions.length === 0) {
      return res.status(400).json({ error: "Kies minimaal één recht voor medewerkers." });
    }

    if (role !== Role.STAFF && permissions.length > 0) {
      return res.status(400).json({ error: "Rechten zijn alleen van toepassing op medewerkers (staff)." });
    }

    if (role === Role.STAFF) {
      permissions = sanitizeStaffPermissions(permissions);
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ error: "Dit e-mailadres is al in gebruik." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        stationId,
        permissions: role === Role.STAFF ? permissions : [],
      },
      select: userSelect,
    });

    return res.status(201).json(created);
  })
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { user: actor } = req;
    const id = req.params.id;

    const target = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!target) {
      return res.status(404).json({ error: "Gebruiker niet gevonden." });
    }

    if (isStationAdmin(actor)) {
      if (target.stationId !== actor.stationId) {
        return res.status(403).json({ error: "Geen toegang tot deze gebruiker." });
      }
      if (!isStaff(target)) {
        return res.status(403).json({ error: "Alleen medewerkers kunnen hier worden aangepast." });
      }
      const permissions = sanitizeStaffPermissions(req.body?.permissions);
      if (permissions.length === 0) {
        return res.status(400).json({ error: "Minimaal één recht verplicht." });
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { permissions },
        select: userSelect,
      });
      return res.json(updated);
    }

    if (isSuperAdmin(actor)) {
      const patch = {};
      if (typeof req.body?.name === "string") patch.name = req.body.name.trim();
      if (typeof req.body?.email === "string") patch.email = req.body.email.trim().toLowerCase();
      if (req.body?.role !== undefined) {
        if (![Role.SUPER_ADMIN, Role.STATION_ADMIN, Role.STAFF].includes(req.body.role)) {
          return res.status(400).json({ error: "Ongeldige rol." });
        }
        patch.role = req.body.role;
        if (patch.role === Role.SUPER_ADMIN) {
          patch.stationId = null;
          patch.permissions = [];
        }
        if (patch.role === Role.STATION_ADMIN) {
          patch.permissions = [];
        }
      }
      if (req.body?.stationId !== undefined) {
        patch.stationId = req.body.stationId || null;
      }
      if (req.body?.permissions !== undefined) {
        patch.permissions =
          (patch.role ?? target.role) === Role.STAFF || target.role === Role.STAFF
            ? sanitizeStaffPermissions(req.body.permissions)
            : sanitizePermissions(req.body.permissions);
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "Niets om bij te werken." });
      }

      const nextRole = patch.role ?? target.role;
      const nextStation = patch.stationId !== undefined ? patch.stationId : target.stationId;
      const nextPerms =
        patch.permissions !== undefined ? patch.permissions : normalizePermissions(target.permissions);

      if (nextRole !== Role.SUPER_ADMIN && !nextStation) {
        return res.status(400).json({ error: "stationId verplicht voor deze rol." });
      }
      if (nextRole === Role.STAFF && nextPerms.length === 0) {
        return res.status(400).json({ error: "Staff moet minimaal één recht hebben." });
      }
      if (nextRole !== Role.STAFF && patch.permissions !== undefined) {
        patch.permissions = [];
      }

      const updated = await prisma.user.update({
        where: { id },
        data: patch,
        select: userSelect,
      });
      return res.json(updated);
    }

    return res.status(403).json({ error: "Geen rechten." });
  })
);

usersRouter.delete(
  "/:id",
  requireRoles(Role.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const actor = req.user;
    const id = req.params.id;

    if (id === actor.id) {
      return res.status(400).json({ error: "Je kunt je eigen account niet verwijderen." });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: "Gebruiker niet gevonden." });
    }

    if (target.role === Role.SUPER_ADMIN) {
      const superCount = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
      if (superCount <= 1) {
        return res.status(400).json({
          error: "De laatste super admin kan niet worden verwijderd. Wijs eerst een andere super admin aan.",
        });
      }
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ ok: true, message: "Gebruiker verwijderd." });
  })
);
