import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <RegisterForm initialReferralCode={ref} />
    </div>
  );
}
