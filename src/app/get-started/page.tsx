import type { Metadata } from "next";
import { GetStartedClient } from "@/components/get-started-client";
import { GET_STARTED_CTA } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: `${GET_STARTED_CTA} — LevelUp`,
  description:
    "Answer a quick health & lifestyle questionnaire and get personalized macros, habits, and coaching before you sign up.",
};

export default function GetStartedPage() {
  return <GetStartedClient />;
}
