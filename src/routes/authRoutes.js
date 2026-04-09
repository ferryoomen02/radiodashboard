import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { signToken } from "../authTokens.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { Role } from "../constants/roles.js";

export const authRouter = Router();

function hashInviteToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

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

authRouter.get(
  "/invite/preview",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      return res.status(400).json({ valid: false, error: "Geen token." });
    }
    const tokenHash = hashInviteToken(token);
    const row = await prisma.inviteToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt) {
      return res.json({ valid: false, error: "Ongeldige of gebruikte uitnodiging." });
    }
    if (row.expiresAt < new Date()) {
      return res.json({ valid: false, error: "Uitnodiging verlopen." });
    }
    return res.json({
      valid: true,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt,
    });
  })
);

authRouter.post(
  "/register-invite",
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!token || !name || !password) {
      return res.status(400).json({ error: "Token, naam en wachtwoord zijn verplicht." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Wachtwoord minimaal 6 tekens." });
    }

    const tokenHash = hashInviteToken(token);
    const invite = await prisma.inviteToken.findUnique({ where: { tokenHash } });
    if (!invite || invite.usedAt) {
      return res.status(400).json({ error: "Ongeldige of gebruikte uitnodiging." });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ error: "Uitnodiging verlopen." });
    }

    const exists = await prisma.user.findUnique({ where: { email: invite.email } });
    if (exists) {
      return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return tx.user.create({
        data: {
          email: invite.email,
          name,
          passwordHash,
          role: invite.role,
          stationId: null,
        },
        include: { station: true },
      });
    });

    const jwt = signToken(user.id);
    return res.status(201).json({
      token: jwt,
      user: userPayload(user),
      station: stationPayload(user),
    });
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
