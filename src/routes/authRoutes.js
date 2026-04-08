import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { signToken } from "../authTokens.js";
import { asyncHandler } from "../asyncHandler.js";

export const authRouter = Router();

const SALT_ROUNDS = 10;

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const stationName =
    typeof req.body?.stationName === "string" && req.body.stationName.trim()
      ? req.body.stationName.trim()
      : null;

  if (!email || !password) {
    return res.status(400).json({ error: "Vul email en password in." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Wachtwoord moet minstens 6 tekens zijn." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: "Dit e-mailadres is al geregistreerd." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const defaultStationName = stationName || `Station van ${email}`;

  const user = await prisma.$transaction(async (tx) => {
    const station = await tx.station.create({
      data: { name: defaultStationName },
    });
    return tx.user.create({
      data: {
        email,
        passwordHash,
        stationId: station.id,
      },
      include: { station: true },
    });
  });

  const token = signToken(user.id);
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email },
    station: { id: user.station.id, name: user.station.name },
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
    user: { id: user.id, email: user.email },
    station: { id: user.station.id, name: user.station.name },
  });
  })
);
