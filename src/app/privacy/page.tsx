import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { CONTACT_EMAIL, SITE_URL, SUPPORT_PHONE_DISPLAY } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Privacy Policy — ${PLATFORM_NAME}`,
  description: `How ${PLATFORM_NAME} collects, uses, and protects your personal data.`,
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="Last updated: July 14, 2026"
    >
      <section className="space-y-4">
        <h2>1. Overview</h2>
        <p>
          This Privacy Policy explains how {PLATFORM_NAME} (&quot;we&quot;,
          &quot;us&quot;) collects, uses, shares, and protects personal data when
          you use{" "}
          <a href={SITE_URL} className="text-primary hover:underline">
            rutina.al
          </a>{" "}
          and related services (the &quot;Service&quot;).
        </p>
        <p>
          By using the Service, you acknowledge this policy. Where consent is
          required (for example, optional health details or certain AI features),
          we will ask for it or obtain it through your use of those features.
        </p>
      </section>

      <section className="space-y-4">
        <h2>2. Who we are</h2>
        <p>
          {PLATFORM_NAME} operates the fitness coaching platform available at
          rutina.al. For privacy requests, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2>3. Data we collect</h2>
        <h3>Account &amp; contact data</h3>
        <ul>
          <li>Name, email address, and password (stored hashed)</li>
          <li>Optional phone number</li>
          <li>Profile settings such as locale, unit system, avatar, and preferences</li>
        </ul>
        <h3>Health, lifestyle &amp; intake data</h3>
        <ul>
          <li>Age, gender, height, weight, and fitness goals</li>
          <li>
            Optional intake questionnaire answers (for example sleep, diet,
            allergies, injuries, medications, stress, work schedule, and related lifestyle details)
          </li>
          <li>Macro targets and water goals</li>
        </ul>
        <h3>Fitness &amp; usage content</h3>
        <ul>
          <li>Workouts, sessions, cardio, habits, and calendar entries</li>
          <li>Meal logs, macros, grocery lists, and related nutrition data</li>
          <li>Weight and body measurement logs</li>
          <li>Progress photos and meal photos you upload</li>
          <li>AI chat messages, plan requests, and coaching interactions</li>
        </ul>
        <h3>Payments &amp; subscriptions</h3>
        <ul>
          <li>
            Subscription plan, status, billing interval, and order references
            processed via PokPay
          </li>
          <li>Challenge entry payments and related order metadata when applicable</li>
          <li>We do not store full payment card numbers on our servers</li>
        </ul>
        <h3>Technical &amp; diagnostic data</h3>
        <ul>
          <li>Device/browser information, IP address, and approximate location derived from network data</li>
          <li>Pages visited, feature usage, and performance metrics</li>
          <li>Error and crash logs used to keep the Service reliable</li>
        </ul>
        <h3>Local device data</h3>
        <ul>
          <li>Authentication session cookies needed to keep you signed in</li>
          <li>Theme, accent, and similar UI preferences in local storage</li>
          <li>Draft intake answers stored locally on your device before signup</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>4. How we use data</h2>
        <ul>
          <li>Create and manage your account</li>
          <li>Deliver personalized workouts, nutrition tools, and coaching</li>
          <li>Process subscriptions, challenge fees, and related billing</li>
          <li>
            Power AI features you use (meal analysis, chat, plans, predictions,
            recommendations, and reports)
          </li>
          <li>Run live classes, challenges, rankings, and progress features</li>
          <li>Send service notices (for example plan delivery, billing, or security alerts)</li>
          <li>Improve product quality, prevent abuse, and fix bugs</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>5. Legal bases (EEA / UK and similar)</h2>
        <p>Where GDPR or similar laws apply, we process personal data under these bases:</p>
        <ul>
          <li>
            <strong>Contract:</strong> to provide the Service you request (account,
            plans, payments, core tracking features)
          </li>
          <li>
            <strong>Legitimate interests:</strong> security, fraud prevention,
            product improvement, and aggregated analytics — balanced against your rights
          </li>
          <li>
            <strong>Consent:</strong> optional health/intake details and certain
            voluntary features; you may withdraw consent where processing is consent-based
          </li>
          <li>
            <strong>Legal obligation:</strong> when we must keep records for tax,
            accounting, or lawful requests
          </li>
        </ul>
        <p>
          Health-related information you choose to provide is used to personalize
          coaching and plans. Provide only what you are comfortable sharing.
        </p>
      </section>

      <section className="space-y-4">
        <h2>6. How we share data</h2>
        <p>We do not sell your personal data. We share data only as needed with:</p>
        <ul>
          <li>
            <strong>Infrastructure providers</strong> such as Supabase (database,
            authentication, file storage) and our hosting platform
          </li>
          <li>
            <strong>Payment processors</strong> such as PokPay to complete transactions
          </li>
          <li>
            <strong>AI providers</strong> (for example OpenAI and/or Anthropic) when
            you use AI features — limited to the content needed for that request
          </li>
          <li>
            <strong>Optional search/tools</strong> used by AI coaching for
            web-assisted answers, when that capability is enabled
          </li>
          <li>
            <strong>Monitoring &amp; performance tools</strong> such as error
            tracking (e.g. Sentry) and performance insights
          </li>
          <li>
            <strong>Coaches / platform operators</strong> who need access to
            deliver your training, review progress, or provide support
          </li>
          <li>
            <strong>Authorities</strong> when required by law or to protect rights,
            safety, and the integrity of the Service
          </li>
        </ul>
        <p>
          Challenge leaderboards or community features may display your display
          name, progress metrics, or other information you choose to share in that
          context.
        </p>
      </section>

      <section className="space-y-4">
        <h2>7. International transfers</h2>
        <p>
          Some providers process data in countries outside Albania or the EEA.
          Where required, we rely on appropriate safeguards such as the
          provider&apos;s standard contractual clauses or equivalent transfer
          mechanisms.
        </p>
      </section>

      <section className="space-y-4">
        <h2>8. Retention</h2>
        <ul>
          <li>
            Account, profile, and fitness data are generally kept while your
            account is active
          </li>
          <li>
            Meal photos are typically retained for a limited period (about 30
            days) and then removed according to our photo expiration process
          </li>
          <li>
            Billing and transaction records may be kept longer as required for
            accounting, disputes, or legal compliance
          </li>
          <li>
            After account deletion requests, we delete or anonymize personal data
            within a reasonable period, except where retention is required by law
            or for legitimate security/billing needs
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>9. Security</h2>
        <p>
          We use industry-standard safeguards including encrypted connections
          (HTTPS), access controls, authenticated sessions, and database
          row-level security for user data. No method of transmission or storage
          is 100% secure. Please use a strong unique password and notify us of
          any suspected unauthorized access.
        </p>
      </section>

      <section className="space-y-4">
        <h2>10. Your rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export or receive a copy of your data</li>
          <li>Object to or restrict certain processing</li>
          <li>Withdraw consent where processing is based on consent</li>
          <li>Lodge a complaint with a supervisory authority</li>
        </ul>
        <p>
          To exercise these rights, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          . We may need to verify your identity before fulfilling a request.
        </p>
      </section>

      <section className="space-y-4">
        <h2>11. Cookies &amp; local storage</h2>
        <p>
          We use essential cookies and similar technologies for authentication
          and session management so the Service works securely. We also store
          preferences (such as theme and accent) and temporary intake drafts in
          your browser&apos;s local storage. These are not used for advertising
          networks.
        </p>
      </section>

      <section className="space-y-4">
        <h2>12. Children</h2>
        <p>
          The Service is intended for users aged 16 and older. We do not
          knowingly collect personal data from children under 16. If you believe
          a child has provided data, contact us and we will take appropriate
          steps to delete it.
        </p>
      </section>

      <section className="space-y-4">
        <h2>13. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last
          updated&quot; date at the top reflects the latest version. For material
          changes, we may provide additional notice in-app or by email.
        </p>
      </section>

      <section className="space-y-4">
        <h2>14. Contact</h2>
        <p>
          Privacy questions or requests:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          . You can also reach support at{" "}
          <a
            href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}
            className="text-primary hover:underline"
          >
            {SUPPORT_PHONE_DISPLAY}
          </a>{" "}
          or via our{" "}
          <a href="/contact" className="text-primary hover:underline">
            contact page
          </a>
          .
        </p>
        <p>
          Related:{" "}
          <a href="/terms" className="text-primary hover:underline">
            Terms of Service
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
