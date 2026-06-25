import { AiCoachShell } from "@/components/ai-coach-shell";

export default function AiCoachLayout({ children }: { children: React.ReactNode }) {
  return <AiCoachShell>{children}</AiCoachShell>;
}
