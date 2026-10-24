import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="h-80 w-full animate-pulse rounded-xl bg-muted/40" aria-hidden />
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
