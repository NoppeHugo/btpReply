import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, ClientStage } from "../src/generated/prisma/client";

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

  const user = await prisma.user.upsert({
    where: { email: "admin@btpreply.io" },
    update: {},
    create: {
      clientId: client.id,
      email: "admin@btpreply.io",
      role: UserRole.admin,
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

  console.log("Seed OK", { client: client.id, user: user.email, phone: phone.number });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
