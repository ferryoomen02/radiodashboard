import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { signToken } from "../authTokens.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
export const authRouter = Router();

const SALT_ROUNDS = 10;

function userPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function stationPayload(user) {
  if (!user.station) return null;
  return { id: user.station.id, name: user.station.name };
}

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({
      user: userPayload(req.user),
      station: stationPayload(req.user),
    });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const current =
      typeof req.body?.currentPassword === "string"
        ? req.body.currentPassword
        : typeof req.body?.oldPassword === "string"
          ? req.body.oldPassword
          : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!current || !newPassword) {
      return res.status(400).json({ error: "Vul huidig en nieuw wachtwoord in." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Nieuw wachtwoord minimaal 6 tekens." });
    }

    const ok = await bcrypt.compare(current, req.user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Huidig wachtwoord klopt niet." });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) },
    });

    return res.json({ ok: true, message: "Wachtwoord bijgewerkt." });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Vul email en password in." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { station: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Verkeerd e-mailadres of wachtwoord." });
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: userPayload(user),
      station: stationPayload(user),
    });
  })
);
