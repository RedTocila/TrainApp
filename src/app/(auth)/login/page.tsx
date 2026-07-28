import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-xl bg-muted/40" />}>
      <LoginForm authError={error} />
    </Suspense>
  );
}
