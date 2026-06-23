import { RegisterForm } from "@/components/register-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <RegisterForm />
    </div>
  );
}
