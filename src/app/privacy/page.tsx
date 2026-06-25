import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { SITE_URL } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Privacy Policy — RUTINA",
  description: "How RUTINA collects, uses, and protects your personal data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="Last updated: June 23, 2025"
    >
      <section className="space-y-4">
        <h2>1. Overview</h2>
        <p>
          RUTINA (&quot;we&quot;, &quot;us&quot;) respects your privacy. This policy explains what
          data we collect, why we collect it, and your choices.
        </p>
      </section>

      <section className="space-y-4">
        <h2>2. Data we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> name, email, password (hashed), profile
            settings.
          </li>
          <li>
            <strong>Health & lifestyle info:</strong> weight, height, goals, daily
            routine, work schedule (optional, for custom nutrition plans).
          </li>
          <li>
            <strong>Fitness data:</strong> workouts, meals, macros, water, habits,
            cardio, weight logs, calendar entries.
          </li>
          <li>
            <strong>AI features:</strong> meal photos or text you submit for logging
            and coaching (AI plan only).
          </li>
          <li>
            <strong>Payment data:</strong> processed by our payment provider; we store
            subscription status, plan, and billing interval — not full card numbers.
          </li>
          <li>
            <strong>Usage data:</strong> device/browser type, pages visited, and
            error logs to improve the product.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>3. How we use data</h2>
        <ul>
          <li>Provide and personalize the RUTINA experience.</li>
          <li>Process subscriptions and custom plan orders.</li>
          <li>Generate AI meal suggestions, reports, and recommendations.</li>
          <li>Deliver coach-built custom plans and live coaching access.</li>
          <li>Send service-related notifications (e.g. plan delivered).</li>
          <li>Improve security, fix bugs, and analyze aggregate usage.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>4. Legal basis (EEA users)</h2>
        <p>
          We process data based on contract performance (providing the service),
          legitimate interests (security and improvement), and consent where required
          (e.g. optional health information).
        </p>
      </section>

      <section className="space-y-4">
        <h2>5. Sharing</h2>
        <p>We do not sell your personal data. We share data only with:</p>
        <ul>
          <li>
            Infrastructure providers (hosting, database — e.g. Supabase) under data
            processing agreements.
          </li>
          <li>Payment processors to complete transactions.</li>
          <li>AI providers when you use AI features, limited to submitted content.</li>
          <li>Authorities when required by law.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>6. Retention</h2>
        <p>
          We keep account and fitness data while your account is active. You may
          request deletion by contacting us. Some records may be retained for legal
          or billing compliance.
        </p>
      </section>

      <section className="space-y-4">
        <h2>7. Security</h2>
        <p>
          We use industry-standard measures including encrypted connections, access
          controls, and row-level security on user data. No method of transmission is
          100% secure.
        </p>
      </section>

      <section className="space-y-4">
        <h2>8. Your rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal data.</li>
          <li>Export your data.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Withdraw consent where processing is consent-based.</li>
        </ul>
        <p>
          Contact{" "}
          <a href="mailto:redtocila@gmail.com" className="text-primary hover:underline">
            redtocila@gmail.com
          </a>{" "}
          to exercise these rights.
        </p>
      </section>

      <section className="space-y-4">
        <h2>9. Cookies & local storage</h2>
        <p>
          We use essential cookies for authentication and session management. Theme
          and accent preferences are stored in local storage on your device.
        </p>
      </section>

      <section className="space-y-4">
        <h2>10. Changes</h2>
        <p>
          We may update this policy. The &quot;Last updated&quot; date at the top reflects
          the latest version.
        </p>
      </section>
    </LegalPageShell>
  );
}
