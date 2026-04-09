import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const BUILTIN_FEATURES = [
  { key: "dashboard", label: "Dashboard", description: "Hoofdscherm en radioweergave" },
  { key: "tracks", label: "Tracks & playlist", description: "Nummers toevoegen en geschiedenis" },
  { key: "users", label: "Gebruikers", description: "Accounts voor het station" },
  { key: "stations", label: "Zenderbeheer", description: "Zenders en functies beheren" },
  { key: "invites", label: "Uitnodigingen (super)", description: "Super admins uitnodigen" },
  { key: "djs", label: "DJ's", description: "DJ-beheer (module)" },
  { key: "audiologger", label: "Audiologger", description: "Audiologger (module)" },
  { key: "files", label: "Bestanden (verkeer)", description: "Verkeersinformatie / bestanden" },
  { key: "site_settings", label: "Site-instellingen", description: "Site-instellingen per zender" },
];

async function seedFeatureDefinitions() {
  for (const f of BUILTIN_FEATURES) {
    await prisma.featureDefinition.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        label: f.label,
        description: f.description,
        isBuiltIn: true,
      },
      update: {
        label: f.label,
        description: f.description,
        isBuiltIn: true,
      },
    });
  }
  console.log("Feature-definities bijgewerkt:", BUILTIN_FEATURES.length);
}

async function main() {
  await seedFeatureDefinitions();
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
