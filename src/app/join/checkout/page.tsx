import { redirect } from "next/navigation";

export default async function JoinCheckoutRedirect({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.plan) q.set("plan", params.plan);
  if (params.interval) q.set("interval", params.interval);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/register${suffix}`);
}
