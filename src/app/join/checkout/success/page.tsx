import { redirect } from "next/navigation";

export default function JoinCheckoutSuccessRedirect() {
  redirect("/dashboard");
}
