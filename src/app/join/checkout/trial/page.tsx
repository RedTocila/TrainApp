import { redirect } from "next/navigation";

export default async function JoinTrialRedirect({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const params = await searchParams;
  const interval = params.interval === "annual" ? "annual" : "monthly";
  redirect(`/register?plan=ai&interval=${interval}`);
}
