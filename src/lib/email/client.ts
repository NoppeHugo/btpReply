import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

let _transporter: Transporter | null = null;

/** Email actif seulement si les 3 variables SMTP sont présentes. */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

/**
 * Transport SMTP (Gmail par défaut).
 * Variables : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 * Pour Gmail : host smtp.gmail.com, port 587, user = adresse Gmail,
 * pass = "mot de passe d'application" (pas le mot de passe du compte).
 */
function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Configuration SMTP manquante (SMTP_HOST / SMTP_USER / SMTP_PASS)"
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL implicite, 587 = STARTTLS
    auth: { user, pass },
  });

  return _transporter;
}

export const FROM_EMAIL =
  process.env.FROM_EMAIL ?? process.env.SMTP_USER ?? "Rappl <noreply@rappl.be>";

type SendEmailParams = {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
};

/**
 * Envoie un email via SMTP. Retourne `{ error }` (null si succès) pour rester
 * compatible avec les appels existants.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ error: { message: string } | null }> {
  // SMTP non configuré : on ne bloque pas le flux (lead créé quand même), on log.
  if (!isEmailConfigured()) {
    logger.warn(
      { to: params.to, subject: params.subject },
      "SMTP non configuré — email ignoré"
    );
    return { error: null };
  }

  try {
    await getTransporter().sendMail({
      from: params.from ?? FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { error: null };
  } catch (err) {
    return {
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}
