#!/usr/bin/env node
/**
 * Eenmalig: zet een bestaande gebruiker op SUPER_ADMIN in de database.
 *
 * Gebruik (lokaal of op productie, met juiste DATABASE_URL):
 *   node scripts/promote-super-admin.mjs
 *   node scripts/promote-super-admin.mjs ander@example.com
 *
 * Standaard e-mail: ferry@ferryoomen.nl
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const DEFAULT_EMAIL = "ferry@ferryoomen.nl";

const email = (
  process.argv[2] ||
  process.env.PROMOTE_SUPER_EMAIL ||
  DEFAULT_EMAIL
)
  .trim()
  .toLowerCase();

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Geen gebruiker met e-mail: ${email}`);
    process.exit(1);
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "SUPER_ADMIN",
      stationId: null,
      permissions: [],
    },
  });
  console.log("OK — gebruiker is nu SUPER_ADMIN:", updated.email, `(${updated.id})`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
