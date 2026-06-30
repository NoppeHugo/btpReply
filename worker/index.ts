import "dotenv/config";
import cron from "node-cron";
import { runDailyRecap } from "./jobs/dailyRecap";
import { runRgpdPurge } from "./jobs/rgpdPurge";

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
