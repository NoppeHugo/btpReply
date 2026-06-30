import { db } from "@/lib/db";
import { DayOfWeek } from "@/generated/prisma/client";

/** Mappe le nom de jour anglais (Intl) vers le DayOfWeek Prisma. */
const WEEKDAY_MAP: Record<string, DayOfWeek> = {
  monday: DayOfWeek.monday,
  tuesday: DayOfWeek.tuesday,
  wednesday: DayOfWeek.wednesday,
  thursday: DayOfWeek.thursday,
  friday: DayOfWeek.friday,
  saturday: DayOfWeek.saturday,
  sunday: DayOfWeek.sunday,
};

/** Convertit "HH:MM" → total en minutes depuis minuit. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * P5-T3 : vérifie si le moment donné est dans les heures d'ouverture du client.
 * Si aucune règle n'est configurée pour ce jour, on considère que le client est ouvert.
 */
export async function isWithinBusinessHours(
  clientId: string,
  now: Date
): Promise<boolean> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { timezone: true },
  });

  if (!client) return true;

  const tz = client.timezone;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)!.value;

  const dayKey = get("weekday").toLowerCase();
  const dayOfWeek = WEEKDAY_MAP[dayKey];
  if (!dayOfWeek) return true;

  const hour = parseInt(get("hour")) % 24;
  const minute = parseInt(get("minute"));
  const nowMinutes = hour * 60 + minute;

  const rule = await db.businessHours.findUnique({
    where: { clientId_dayOfWeek: { clientId, dayOfWeek } },
  });

  if (!rule) return true;        // pas de règle = toujours ouvert
  if (rule.closed) return false; // jour explicitement fermé

  return (
    nowMinutes >= timeToMinutes(rule.openTime) &&
    nowMinutes < timeToMinutes(rule.closeTime)
  );
}
