import type { ReactNode } from "react";
import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Button } from "@/components/ui/button";

export function LegalPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingNav />
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/">
            <Button variant="ghost" size="sm" className="-ml-2 mb-6">
              ← Back to home
            </Button>
          </Link>
          <header className="mb-10 space-y-3">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </header>
          <article className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-4 [&_ul]:list-disc [&_ul]:space-y-2">
            {children}
          </article>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
