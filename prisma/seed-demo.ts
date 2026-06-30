import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  ConversationState,
  MessageDirection,
  LeadUrgency,
  LeadStatus,
} from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Données de démonstration : un parcours complet appel manqué → conversation → lead.
// Idempotent : IDs fixes + upsert. Rattaché au client de seed (seed-client-01).
async function main() {
  const clientId = "seed-client-01";

  const phone = await prisma.phoneNumber.findUnique({
    where: { number: "+32499000001" },
  });
  if (!phone) {
    throw new Error(
      "PhoneNumber +32499000001 introuvable — lance d'abord `pnpm exec tsx prisma/seed.ts`"
    );
  }

  const callerNumber = "+32471425495";
  const now = new Date();

  // 1. Appel manqué
  const call = await prisma.call.upsert({
    where: { twilioCallSid: "DEMO-CALL-0001" },
    update: {},
    create: {
      id: "demo-call-0001",
      clientId,
      phoneNumberId: phone.id,
      callerNumber,
      calledAt: now,
      twilioCallSid: "DEMO-CALL-0001",
    },
  });

  // 2. Conversation qualifiée
  const conversation = await prisma.conversation.upsert({
    where: { callId: call.id },
    update: { state: ConversationState.qualified, turnCount: 3 },
    create: {
      id: "demo-conv-0001",
      clientId,
      callId: call.id,
      callerNumber,
      state: ConversationState.qualified,
      turnCount: 3,
      language: "fr",
    },
  });

  // 3. Fil de messages (style SMS)
  const messages: Array<{ direction: MessageDirection; body: string }> = [
    {
      direction: MessageDirection.outbound,
      body: "Bonjour, ici Plomberie Dupont. Nous avons vu votre appel mais n'avons pas pu décrocher. Comment pouvons-nous vous aider ? (Répondez STOP pour ne plus être contacté.)",
    },
    {
      direction: MessageDirection.inbound,
      body: "Bonjour, j'ai une fuite d'eau sous l'évier de la cuisine, c'est assez urgent.",
    },
    {
      direction: MessageDirection.outbound,
      body: "Je comprends, c'est noté. Vous êtes à quelle adresse, et quand seriez-vous disponible ?",
    },
    {
      direction: MessageDirection.inbound,
      body: "Rue de la Loi 12 à Bruxelles. Je suis dispo cet après-midi ou demain matin.",
    },
    {
      direction: MessageDirection.outbound,
      body: "Parfait, je transmets à un de nos plombiers qui vous rappelle très vite pour confirmer le passage. Bonne journée !",
    },
  ];

  // Reset des messages de démo pour éviter les doublons à chaque exécution
  await prisma.message.deleteMany({
    where: { conversationId: conversation.id },
  });
  let i = 0;
  for (const m of messages) {
    await prisma.message.create({
      data: {
        clientId,
        conversationId: conversation.id,
        direction: m.direction,
        body: m.body,
        sentAt: new Date(now.getTime() + i * 60_000),
      },
    });
    i++;
  }

  // 4. Lead qualifié
  const lead = await prisma.lead.upsert({
    where: { conversationId: conversation.id },
    update: {},
    create: {
      clientId,
      conversationId: conversation.id,
      type: "Fuite d'eau / plomberie",
      urgency: LeadUrgency.high,
      location: "Rue de la Loi 12, Bruxelles",
      availability: "Cet après-midi ou demain matin",
      summary:
        "Fuite d'eau urgente sous l'évier de cuisine. Client disponible cet après-midi ou demain matin. À rappeler en priorité.",
      status: LeadStatus.new,
    },
  });

  console.log("Demo OK", {
    call: call.id,
    conversation: conversation.id,
    messages: messages.length,
    lead: lead.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
