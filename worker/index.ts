import "dotenv/config";
import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { validateEnv } from "../src/lib/env";
import { runDailyRecap } from "./jobs/dailyRecap";
import { runRgpdPurge } from "./jobs/rgpdPurge";
import { runScheduledJobs } from "./jobs/scheduledJobs";

// Sentry — initialiser avant tout le reste
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.1,
});

// Valider les variables d'environnement au démarrage
validateEnv();

// Jobs persistants (SMS initial différé…) — toutes les 10 secondes
cron.schedule("*/10 * * * * *", async () => {
  await runScheduledJobs();
});

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

console.log("Worker démarré — crons actifs");
