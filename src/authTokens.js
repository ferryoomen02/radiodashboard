import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_DAYS
  ? `${process.env.JWT_EXPIRES_DAYS}d`
  : "7d";

export function assertJwtConfigured() {
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error(
      "Zet JWT_SECRET in .env (minimaal 16 tekens). Zie .env.example."
    );
  }
}

export function signToken(userId) {
  assertJwtConfigured();
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  assertJwtConfigured();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
