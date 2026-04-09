import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRoles } from "../middleware/requireRoles.js";
import { Role } from "../constants/roles.js";
import { asyncHandler } from "../asyncHandler.js";
import { sendInviteEmail } from "../lib/mail.js";

export const invitesRouter = Router();
invitesRouter.use(requireAuth);
invitesRouter.use(requireRoles(Role.SUPER_ADMIN));

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function inviteLink(token) {
  const base = process.env.PUBLIC_APP_URL || "";
  const path = `/register?token=${encodeURIComponent(token)}`;
  if (base) return `${base.replace(/\/$/, "")}${path}`;
  return path;
}

async function expireStaleInvites() {
  await prisma.inviteToken.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

invitesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await expireStaleInvites();
    const rows = await prisma.inviteToken.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return res.json({
      invites: rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: r.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        emailSentAt: r.emailSentAt,
        emailError: r.emailError,
      })),
    });
  })
);

invitesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await expireStaleInvites();
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Geldig e-mailadres verplicht." });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
    }
    const pending = await prisma.inviteToken.findFirst({
      where: { email, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (pending) {
      return res.status(400).json({ error: "Er is al een open uitnodiging voor dit adres." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const row = await prisma.inviteToken.create({
      data: {
        email,
        tokenHash,
        role: Role.SUPER_ADMIN,
        status: "PENDING",
        expiresAt,
        createdById: req.user.id,
      },
    });

    const url = inviteLink(token);
    const mailResult = await sendInviteEmail(email, url);

    const updated = await prisma.inviteToken.update({
      where: { id: row.id },
      data: {
        emailSentAt: mailResult.sent ? new Date() : null,
        emailError: mailResult.sent ? null : mailResult.reason || "not_sent",
      },
    });

    return res.status(201).json({
      email,
      expiresAt,
      inviteUrl: url,
      status: updated.status,
      emailSent: mailResult.sent,
      hint: mailResult.sent
        ? "Uitnodiging per e-mail verzonden."
        : "E-mail niet geconfigureerd (SMTP); kopieer de link en stuur deze zelf.",
    });
  })
);
