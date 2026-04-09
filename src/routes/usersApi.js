import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role, isSuperAdmin, isStationAdmin } from "../constants/roles.js";
import { asyncHandler } from "../asyncHandler.js";

export const usersRouter = Router();

const SALT_ROUNDS = 10;

usersRouter.use(requireAuth);
usersRouter.use((req, res, next) => {
  if (isStationAdmin(req.user) && !req.user.stationId) {
    return res.status(403).json({ error: "Geen zender gekoppeld aan dit station-admin account." });
  }
  next();
});
usersRouter.use(requireRoles(Role.SUPER_ADMIN, Role.STATION_ADMIN));

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  stationId: true,
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

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Naam, e-mail en wachtwoord zijn verplicht." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Wachtwoord minimaal 6 tekens." });
    }

    if (isStationAdmin(actor)) {
      role = Role.USER;
      stationId = actor.stationId;
    } else if (isSuperAdmin(actor)) {
      if (!role) role = Role.USER;
      if (![Role.SUPER_ADMIN, Role.STATION_ADMIN, Role.USER].includes(role)) {
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

    if (isStationAdmin(actor) && role !== Role.USER) {
      return res.status(403).json({ error: "Alleen gebruikers met rol ‘user’ aanmaken." });
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
      },
      select: userSelect,
    });

    return res.status(201).json(created);
  })
);
