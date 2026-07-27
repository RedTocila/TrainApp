import { redirect } from "next/navigation";

/** Deferred guest signup is retired — accounts are free; packages are optional upgrades. */
export default function JoinPricingRedirect() {
  redirect("/register");
}
