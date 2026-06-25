import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { SITE_URL } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Terms of Service — RUTINA",
  description: "Terms of Service for RUTINA fitness platform.",
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="Last updated: June 23, 2025"
    >
      <section className="space-y-4">
        <h2>1. Agreement</h2>
        <p>
          By creating an account or using RUTINA, you agree to these Terms of
          Service. If you do not agree, do not use the service.
        </p>
      </section>

      <section className="space-y-4">
        <h2>2. Service description</h2>
        <p>
          RUTINA provides fitness tracking, workout and nutrition tools, AI-powered
          coaching features (on eligible plans), live coaching sessions, and optional
          one-time custom plans delivered by a trainer. Features vary by subscription
          tier.
        </p>
      </section>

      <section className="space-y-4">
        <h2>3. Accounts</h2>
        <ul>
          <li>You must provide accurate registration information.</li>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>You must be at least 16 years old to use RUTINA.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>4. Subscriptions & payments</h2>
        <ul>
          <li>
            Paid plans (RUTINA Core and RUTINA AI) are billed monthly or
            annually as selected at checkout.
          </li>
          <li>
            One-time custom workout and nutrition plans are separate purchases.
          </li>
          <li>
            Prices are shown in ALL (Albanian Lek) or EUR at a fixed rate of 100 ALL per 1 EUR. Taxes may apply depending on your location.
          </li>
          <li>
            You may cancel recurring subscriptions from your account; access
            continues until the end of the paid period.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>5. Health disclaimer</h2>
        <p>
          RUTINA is not a medical service. Content, AI suggestions, and coaching
          are for general fitness purposes only. Consult a physician before starting
          any exercise or nutrition program. You use the app at your own risk.
        </p>
      </section>

      <section className="space-y-4">
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Abuse, reverse engineer, or disrupt the platform.</li>
          <li>Upload unlawful, harmful, or infringing content.</li>
          <li>Share account access or resell the service without permission.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>7. Intellectual property</h2>
        <p>
          RUTINA, its branding, and platform content are owned by RUTINA or its
          licensors. You retain ownership of data you submit (workouts, logs, etc.)
          and grant us a license to store and process it to provide the service.
        </p>
      </section>

      <section className="space-y-4">
        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, RUTINA is provided &quot;as is&quot;
          without warranties. We are not liable for indirect or consequential damages
          arising from your use of the service.
        </p>
      </section>

      <section className="space-y-4">
        <h2>9. Changes</h2>
        <p>
          We may update these terms. Material changes will be reflected on this page
          with an updated date. Continued use after changes constitutes acceptance.
        </p>
      </section>

      <section className="space-y-4">
        <h2>10. Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:redtocila@gmail.com" className="text-primary hover:underline">
            redtocila@gmail.com
          </a>{" "}
          or visit our{" "}
          <a href="/contact" className="text-primary hover:underline">
            contact page
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
