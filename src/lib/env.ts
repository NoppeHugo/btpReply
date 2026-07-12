const REQUIRED: Record<string, string> = {
  DATABASE_URL: "Connexion PostgreSQL",
  ANTHROPIC_API_KEY: "Qualification LLM",
  TWILIO_ACCOUNT_SID: "API Twilio (Account SID) — envoi SMS + voix",
  TWILIO_AUTH_TOKEN: "API Twilio (Auth Token) — envoi SMS + voix",
  TWILIO_WEBHOOK_SIGNING_KEY: "Signature webhooks Twilio (voix + SMS entrant)",
  APP_BASE_URL: "URL de l'application",
  API_SECRET_KEY: "Auth API bearer",
  AUTH_SECRET: "Auth.js sessions",
};

const OPTIONAL: Record<string, string> = {
  STRIPE_SECRET_KEY: "Facturation Stripe",
  STRIPE_WEBHOOK_SECRET: "Webhook Stripe",
  STRIPE_PRICE_BASE: "Plan base Stripe",
  STRIPE_PRICE_PLUS: "Plan plus Stripe",
  SENTRY_DSN: "Observabilité erreurs",
  ANTHROPIC_MODEL_QUALIFICATION: "Modèle LLM (défaut: claude-haiku-4-5-20251001)",
  INITIAL_SMS_DELAY_MS: "Délai SMS initial (défaut: 30000)",
  SMTP_HOST: "Serveur SMTP (emails) — optionnel",
  SMTP_USER: "Utilisateur SMTP — optionnel",
  SMTP_PASS: "Mot de passe SMTP — optionnel",
  SMTP_PORT: "Port SMTP (défaut: 587)",
  FROM_EMAIL: "Adresse expéditeur email (défaut: SMTP_USER)",
  VAPID_PUBLIC_KEY: "Web Push (clé publique VAPID) — optionnel",
  VAPID_PRIVATE_KEY: "Web Push (clé privée VAPID) — optionnel",
  VAPID_SUBJECT: "Web Push (contact, ex: mailto:contact@rappl.be)",
  ALERT_ADMIN_EMAIL: "Alertes ops internes (jobs en échec) — optionnel",
};

export type EnvStatus = {
  key: string;
  label: string;
  required: boolean;
  set: boolean;
};

export function checkEnv(): EnvStatus[] {
  const results: EnvStatus[] = [];

  for (const [key, label] of Object.entries(REQUIRED)) {
    results.push({ key, label, required: true, set: !!process.env[key] });
  }
  for (const [key, label] of Object.entries(OPTIONAL)) {
    results.push({ key, label, required: false, set: !!process.env[key] });
  }

  return results;
}

/**
 * Appelé au démarrage de l'app et du worker.
 * Lance une exception si une variable requise est manquante.
 */
export function validateEnv(): void {
  const missing = Object.keys(REQUIRED).filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(", ")}`
    );
  }
}
