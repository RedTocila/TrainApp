import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="h-80 w-full max-w-md animate-pulse rounded-xl bg-muted/40" />}>
        <LoginForm authError={error} />
      </Suspense>
    </div>
  );
}
