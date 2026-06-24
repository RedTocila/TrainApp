import type { Metadata } from "next";
import { GetStartedClient } from "@/components/get-started-client";

export const metadata: Metadata = {
  title: "Get your custom plan — LevelUp",
  description:
    "Answer a quick health & lifestyle questionnaire and get personalized macros, habits, and coaching before you sign up.",
};

export default function GetStartedPage() {
  return <GetStartedClient />;
}
