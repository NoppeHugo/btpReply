import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { PhoneMissed } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-neutral-950">
              <PhoneMissed className="size-5" />
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Rappl
          </h1>
          <p className="mt-1 text-sm text-white/50">Connexion à votre espace</p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
            Identifiants invalides.
          </p>
        )}

        <form
          action={async (formData: FormData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/dashboard",
              });
            } catch (err) {
              if (err instanceof AuthError) {
                redirect("/login?error=invalid");
              }
              throw err;
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="email" className="app-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="app-input w-full"
              placeholder="vous@exemple.be"
            />
          </div>

          <div>
            <label htmlFor="password" className="app-label">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="app-input w-full"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Se connecter
          </button>

          <p className="text-center">
            <a
              href="/forgot-password"
              className="text-xs text-white/40 transition-colors hover:text-white/70"
            >
              Mot de passe oublié ?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
