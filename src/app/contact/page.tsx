import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { ContactPageContent } from "@/components/landing/contact-page-content";
import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Contact — ${PLATFORM_NAME}`,
  description:
    `Get in touch with ${PLATFORM_NAME} for support, billing questions, or custom training plans.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact"
      description={`Questions about ${PLATFORM_NAME}, billing, or custom plans? We're here to help.`}
    >
      <ContactPageContent />
    </LegalPageShell>
  );
}
