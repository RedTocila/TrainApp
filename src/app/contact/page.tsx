import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { ContactPageContent } from "@/components/landing/contact-page-content";
import { SITE_URL } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Contact — LevelUp",
  description:
    "Get in touch with LevelUp for support, billing questions, or custom training plans.",
  alternates: { canonical: `${SITE_URL}/contact` },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact"
      description="Questions about LevelUp, billing, or custom plans? We're here to help."
    >
      <ContactPageContent />
    </LegalPageShell>
  );
}
