import "dotenv/config";
import cron from "node-cron";
import { runDailyRecap } from "./jobs/dailyRecap";

// Récap quotidien — tous les jours à 20h (Europe/Brussels)
cron.schedule(
  "0 20 * * *",
  async () => {
    await runDailyRecap();
  },
  { timezone: "Europe/Brussels" }
);

console.log("Worker démarré — crons actifs");
