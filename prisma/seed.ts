import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, ClientStage } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const client = await prisma.client.upsert({
    where: { id: "seed-client-01" },
    update: {},
    create: {
      id: "seed-client-01",
      name: "Plomberie Dupont",
      displayName: "Plomberie Dupont (test)",
      stage: ClientStage.active,
      timezone: "Europe/Brussels",
    },
  });

  const passwordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "changeme",
    10
  );

  const user = await prisma.user.upsert({
    where: { email: "admin@btpreply.io" },
    update: { passwordHash },
    create: {
      clientId: client.id,
      email: "admin@btpreply.io",
      role: UserRole.admin,
      passwordHash,
    },
  });

  // Compte owner (artisan) pour tester la vue côté client
  const owner = await prisma.user.upsert({
    where: { email: "patron@plomberie-dupont.be" },
    update: { passwordHash },
    create: {
      clientId: client.id,
      email: "patron@plomberie-dupont.be",
      role: UserRole.owner,
      passwordHash,
    },
  });

  const phone = await prisma.phoneNumber.upsert({
    where: { number: "+32499000001" },
    update: {},
    create: {
      clientId: client.id,
      number: "+32499000001",
      label: "Numéro test Twilio",
      active: true,
    },
  });

  console.log("Seed OK", {
    client: client.id,
    admin: user.email,
    owner: owner.email,
    phone: phone.number,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
