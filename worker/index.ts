import "dotenv/config";
import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { validateEnv } from "../src/lib/env";
import { runDailyRecap } from "./jobs/dailyRecap";
import { runRgpdPurge } from "./jobs/rgpdPurge";
import { runInboundQueue } from "../src/lib/conversations/inbound-queue";

// Sentry — initialiser avant tout le reste
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});

// Valider les variables d'environnement au démarrage
validateEnv();

// Récap quotidien — tous les jours à 20h (Europe/Brussels)
cron.schedule(
  "0 20 * * *",
  async () => {
    await runDailyRecap();
  },
  { timezone: "Europe/Brussels" }
);

// RGPD purge — 1er de chaque mois à 3h du matin
cron.schedule(
  "0 3 1 * *",
  async () => {
    await runRgpdPurge();
  },
  { timezone: "Europe/Brussels" }
);

// File des SMS entrants — drainée toutes les 5 s. Le webhook smstools acquitte
// immédiatement et met en file ; la qualification LLM (lente) s'exécute ici,
// hors du chemin de la requête HTTP. Garde anti-chevauchement : un tick lent
// (LLM) ne doit pas se superposer au suivant.
let inboundQueueRunning = false;
cron.schedule("*/5 * * * * *", async () => {
  if (inboundQueueRunning) return;
  inboundQueueRunning = true;
  try {
    await runInboundQueue();
  } catch (err) {
    Sentry.captureException(err);
  } finally {
    inboundQueueRunning = false;
  }
});

console.log("Worker démarré — crons actifs");
