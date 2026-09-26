import { AuthLayoutFrame } from "@/components/ios/auth-layout-client";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayoutFrame>{children}</AuthLayoutFrame>;
}
