import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_SUPER_EMAIL || "admin@sonicwave.local").toLowerCase().trim();
  const password = process.env.SEED_SUPER_PASSWORD || "changeme-admin";
  const name = process.env.SEED_SUPER_NAME || "Super Admin";

  const hash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN" || existing.stationId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "SUPER_ADMIN",
          stationId: null,
          name: name || existing.name,
        },
      });
      console.log("Account gepromoveerd naar SUPER_ADMIN:", email);
    } else {
      console.log("Super admin bestaat al (wachtwoord ongewijzigd):", email);
    }
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hash,
      role: "SUPER_ADMIN",
      stationId: null,
    },
  });
  console.log("Super admin aangemaakt:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
