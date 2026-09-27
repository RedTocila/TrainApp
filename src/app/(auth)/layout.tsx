import { RouteEnter } from "@/components/route-enter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center px-4 pb-[max(2rem,var(--safe-area-bottom-inset))] pt-[max(2rem,var(--safe-area-top-inset))] sm:py-10">
      <div className="my-auto w-full max-w-md">
        <RouteEnter>{children}</RouteEnter>
      </div>
    </div>
  );
}
