export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center px-4 py-8 sm:py-10">
      <div className="my-auto w-full max-w-md">{children}</div>
    </div>
  );
}
