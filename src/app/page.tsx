import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-xl font-black tracking-tight">
          TRAIN<span className="text-primary">APP</span>
        </span>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">
            TRAIN LIKE A
            <span className="block text-primary">CHAMPION</span>
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Premium personal coaching with custom workouts, nutrition plans,
            macro tracking, and more — built exclusively for you.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Training
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {["Workouts", "Nutrition", "Macros", "Calendar"].map((feature) => (
            <div
              key={feature}
              className="premium-card p-6 text-center"
            >
              <p className="font-bold">{feature}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
