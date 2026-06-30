import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role === "admin") {
    redirect("/dashboard/clients");
  } else {
    redirect("/dashboard/calls");
  }
}
