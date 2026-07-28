import { AuthBackButton } from "@/components/auth-back-button";

export function AuthCardShell({
  children,
  backHref = "/",
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="w-full space-y-4">
      <AuthBackButton href={backHref} />
      {children}
    </div>
  );
}
