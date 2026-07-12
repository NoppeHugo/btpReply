import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/dashboard");

  const client = await db.client.findUnique({
    where: { id: session.user.clientId },
    select: {
      name: true,
      displayName: true,
      onboardingStep: true,
      onboardingCompletedAt: true,
      phoneNumbers: {
        where: { active: true },
        select: { number: true },
        take: 1,
      },
    },
  });
  if (!client) redirect("/login");
  if (client.onboardingCompletedAt) redirect("/dashboard");

  return (
    <OnboardingWizard
      clientName={client.displayName ?? client.name}
      initialStep={client.onboardingStep}
      phoneNumber={client.phoneNumbers[0]?.number ?? null}
    />
  );
}
