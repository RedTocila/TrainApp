import { redirect } from "next/navigation";

export default function AiChatPage() {
  redirect("/dashboard/ai?chat=1");
}
