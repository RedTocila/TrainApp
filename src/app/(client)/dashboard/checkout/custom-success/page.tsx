import { redirect } from "next/navigation";

export default function CustomCheckoutSuccessPage() {
  redirect("/dashboard");
}
