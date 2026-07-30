import type { Metadata } from "next";
import { LegalPageShell } from "@/components/landing/legal-page-shell";
import { CONTACT_EMAIL, SITE_URL, SUPPORT_PHONE_DISPLAY } from "@/lib/landing-content";
import {
  PLATFORM_AI_PRO_NAME,
  PLATFORM_BASIC_NAME,
  PLATFORM_ELITE_NAME,
  PLATFORM_NAME,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of Service — ${PLATFORM_NAME}`,
  description: `Terms of Service for the ${PLATFORM_NAME} fitness coaching platform.`,
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="Last updated: July 31, 2026"
    >
      <section className="space-y-4">
        <h2>1. Agreement</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of{" "}
          {PLATFORM_NAME} at{" "}
          <a href={SITE_URL} className="text-primary hover:underline">
            rutina.al
          </a>
          , including our website, web app, subscriptions, AI coaching features,
          live sessions, challenges, referrals, camera-based logging, and related
          tools (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By creating an account, completing checkout, or using the Service, you
          agree to these Terms and our{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
          . If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="space-y-4">
        <h2>2. The Service</h2>
        <p>
          {PLATFORM_NAME} is a premium personal-training platform. Depending on
          your plan and features you enable, the Service may include:
        </p>
        <ul>
          <li>Personalized workout and nutrition tools, including HIIT and custom plans</li>
          <li>Logging for meals, macros, water, habits, weight, and body metrics</li>
          <li>
            In-app camera tools for meal photos, barcode product lookup, and
            progress photos (live Snapshot or From gallery)
          </li>
          <li>Progress photo check-ins with AI review and identity matching</li>
          <li>Calendar planning, meal photos history, and exercise demo media</li>
          <li>
            AI coaching (&quot;Coach Alex&quot;) on eligible plans, including chat,
            meal analysis, barcode-assisted logging, plans, predictions, and reports
          </li>
          <li>Live coaching classes and community challenges</li>
          <li>Referral codes and credit rewards for eligible invitations</li>
        </ul>
        <p>
          Feature availability depends on your subscription tier (
          {PLATFORM_BASIC_NAME}, {PLATFORM_AI_PRO_NAME}, or {PLATFORM_ELITE_NAME}
          ) and may change as we improve the product.
        </p>
      </section>

      <section className="space-y-4">
        <h2>3. Eligibility &amp; accounts</h2>
        <ul>
          <li>You must be at least 16 years old to create an account or use the Service.</li>
          <li>You must provide accurate registration information and keep it up to date.</li>
          <li>You are responsible for safeguarding your login credentials and for activity under your account.</li>
          <li>One person may not maintain multiple accounts to abuse trials, promotions, referrals, or challenges.</li>
          <li>
            We may suspend or terminate accounts that violate these Terms, pose a
            security risk, or are used in a way that harms other users or the platform.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>4. Subscriptions &amp; payments</h2>
        <h3>Plans &amp; billing</h3>
        <ul>
          <li>
            Paid plans are billed monthly or annually as selected at checkout.
            Prices are displayed in EUR and may exclude applicable taxes.
          </li>
          <li>
            Payments are processed by PokPay. We do not store full payment card
            numbers on our servers.
          </li>
          <li>
            Unless canceled, recurring subscriptions renew automatically at the
            then-current price for your plan and interval.
          </li>
          <li>
            You may cancel a recurring subscription from your account settings.
            Access generally continues through the end of the paid period.
          </li>
          <li>
            Referral discounts and credits may apply at checkout or on eligible
            renewals/challenge entries according to the referral rules shown in the app.
          </li>
        </ul>
        <h3>Refunds</h3>
        <p>
          Except where required by applicable consumer law, fees are
          non-refundable once a billing period has started. If you believe you were
          charged in error, contact us promptly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <h3>Price changes</h3>
        <p>
          We may change subscription prices. For existing subscribers, we will
          provide notice before a price change affects your next renewal where
          required by law.
        </p>
      </section>

      <section className="space-y-4">
        <h2>5. Challenges &amp; optional fees</h2>
        <p>
          {PLATFORM_NAME} may offer flash challenges, transformation challenges,
          or similar programs. Some challenges require a separate entry fee or
          have their own rules, schedules, waitlists, and prize structures.
        </p>
        <ul>
          <li>Challenge entry fees are separate from your subscription unless we state otherwise.</li>
          <li>By joining a challenge, you agree to that challenge&apos;s published rules and scoring method.</li>
          <li>
            We may disqualify participants who cheat, submit false progress data,
            harass others, or otherwise violate challenge rules or these Terms.
          </li>
          <li>
            Prize pools, brackets, and outcomes depend on participation and the
            challenge format; we do not guarantee winnings.
          </li>
          <li>
            Some long challenges may require complete monthly progress photos
            (front, back, and side) before entry or to remain eligible.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>6. Progress photos</h2>
        <p>
          Progress photo check-ins help track physique changes over time. When you
          add or retake a pose, the in-app camera opens so you can take a live{" "}
          <strong>Snapshot</strong> or choose <strong>From gallery</strong>.
        </p>
        <ul>
          <li>
            Photos must be of you. Submitting another person&apos;s image, the wrong
            pose, or misleading edits may result in rejection.
          </li>
          <li>
            We may use AI to review photos for pose, subject, and consistency with
            your profile (including gender) and with your first accepted identity
            baseline.
          </li>
          <li>
            Live Snapshots are preferred for honest progress. Gallery uploads are
            allowed but must still meet the same authenticity rules.
          </li>
          <li>
            If your first photo used the wrong person by mistake, contact support
            so we can reset the identity baseline where appropriate.
          </li>
          <li>
            You must agree to the in-app progress photo Read me rules before uploading.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>7. Meal logging, camera &amp; barcodes</h2>
        <p>
          Meal logging may use your device camera to photograph food or scan product
          barcodes. Barcode lookups may query public product databases (such as Open
          Food Facts) to suggest nutrition values. Those suggestions can be incomplete
          or inaccurate — you remain responsible for confirming macros before saving.
        </p>
        <ul>
          <li>Do not upload unlawful, intimate, or non-food content as meal photos.</li>
          <li>
            Camera and gallery access are used only when you choose photo or barcode
            features; you can deny permission in your browser or device settings.
          </li>
          <li>
            Meal photos may be retained for a limited period for coaching and then
            expire according to our photo retention process (see Privacy Policy).
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>8. AI coaching features</h2>
        <p>
          AI features may generate suggestions, analyses, plans, or chat responses
          based on information you provide (including meal photos, barcode-derived
          product data, progress photos, intake answers, and training logs). AI
          output can be incomplete, inaccurate, or unsuitable for your situation.
          You remain responsible for how you use AI suggestions and for verifying
          information that matters to your health or safety.
        </p>
        <p>
          We may use trusted third-party AI providers to process the content you
          submit when you use AI features. See our Privacy Policy for details.
        </p>
        <p>
          You must acknowledge the Coach Alex Read me rules before chatting where
          the app requires it.
        </p>
      </section>

      <section className="space-y-4">
        <h2>9. Referrals</h2>
        <p>
          Referral codes and credits are promotional and may change. Credits and
          discounts apply only as described in the app at the time of use. Abuse
          (self-referral, fake accounts, or fraud) may void rewards and lead to
          account action.
        </p>
      </section>

      <section className="space-y-4">
        <h2>10. Health &amp; fitness disclaimer</h2>
        <p>
          {PLATFORM_NAME} is a fitness coaching and tracking platform — not a
          medical service, clinic, or emergency service. Content from coaches, the
          app, or AI is for general fitness and lifestyle purposes only and does
          not create a doctor–patient relationship.
        </p>
        <ul>
          <li>
            Consult a qualified healthcare professional before starting any
            exercise, nutrition, or supplement program, especially if you have
            injuries, medical conditions, or take medication.
          </li>
          <li>Stop activity and seek medical help if you experience pain, dizziness, or other concerning symptoms.</li>
          <li>You use the Service at your own risk.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>11. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Break the law or infringe others&apos; rights while using the Service</li>
          <li>Upload unlawful, harmful, abusive, hateful, or infringing content</li>
          <li>Upload content that depicts others without permission, or intimate images without consent</li>
          <li>Submit fake progress photos, meal logs, or challenge data to game rankings or rewards</li>
          <li>Attempt to reverse engineer, scrape, overload, or disrupt the Service</li>
          <li>Share your account, resell access, or bypass plan limits without our permission</li>
          <li>Misrepresent your identity, progress data, referrals, or payments related to challenges</li>
          <li>Use AI or other features to generate content that violates these Terms</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>12. Your content</h2>
        <p>
          You retain ownership of content you submit (such as logs, photos, chat
          messages, barcode selections, and intake answers). You grant{" "}
          {PLATFORM_NAME} a worldwide, non-exclusive license to host, store,
          process, display, and use that content as needed to operate, secure, and
          improve the Service, including providing features you request (such as AI
          review and coaching).
        </p>
        <p>
          You represent that you have the rights to submit the content and that it
          does not violate these Terms or applicable law.
        </p>
      </section>

      <section className="space-y-4">
        <h2>13. Intellectual property</h2>
        <p>
          The Service — including {PLATFORM_NAME} branding, software, UI,
          programs, copy, and other materials we provide — is owned by{" "}
          {PLATFORM_NAME} or its licensors. Except for the limited right to use
          the Service under these Terms, no license is granted to you.
        </p>
      </section>

      <section className="space-y-4">
        <h2>14. Third-party services</h2>
        <p>
          The Service relies on third parties such as hosting providers, payment
          processors, AI vendors, and public product databases used for barcode
          nutrition lookup. Their terms and privacy practices may also apply when
          you use their services through {PLATFORM_NAME}. We are not responsible
          for third-party services we do not control.
        </p>
      </section>

      <section className="space-y-4">
        <h2>15. Suspension &amp; termination</h2>
        <p>
          You may stop using the Service at any time and may request account
          deletion by contacting us. We may suspend or end access if you violate
          these Terms, if required by law, or if we discontinue the Service. Upon
          termination, sections that by nature should survive (including
          disclaimers, limitation of liability, and intellectual property) will
          continue to apply.
        </p>
      </section>

      <section className="space-y-4">
        <h2>16. Disclaimers</h2>
        <p>
          To the maximum extent permitted by law, the Service is provided &quot;as
          is&quot; and &quot;as available&quot; without warranties of any kind,
          whether express or implied, including fitness for a particular purpose,
          merchantability, and non-infringement. We do not warrant that the
          Service will be uninterrupted, error-free, or that AI, barcode nutrition
          data, or coaching outputs will meet your expectations.
        </p>
      </section>

      <section className="space-y-4">
        <h2>17. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {PLATFORM_NAME} and its
          operators, coaches, and affiliates are not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost
          profits, data, or goodwill, arising from your use of the Service.
        </p>
        <p>
          Our total liability for claims relating to the Service will not exceed
          the amounts you paid to {PLATFORM_NAME} for the Service in the twelve
          (12) months before the claim, except where liability cannot be limited
          under applicable law (including for death or personal injury caused by
          negligence where such limitation is prohibited).
        </p>
      </section>

      <section className="space-y-4">
        <h2>18. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless {PLATFORM_NAME} and its
          operators from claims, damages, and expenses (including reasonable legal
          fees) arising from your content, your misuse of the Service, or your
          violation of these Terms or applicable law.
        </p>
      </section>

      <section className="space-y-4">
        <h2>19. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Republic of Albania, without
          regard to conflict-of-law rules. Courts in Albania will have exclusive
          jurisdiction over disputes, subject to mandatory consumer protections
          that may apply where you live.
        </p>
      </section>

      <section className="space-y-4">
        <h2>20. Changes</h2>
        <p>
          We may update these Terms from time to time. The &quot;Last updated&quot;
          date at the top will change when we do. For material changes, we may
          provide additional notice (for example in-app or by email). Continued use
          after the effective date constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="space-y-4">
        <h2>21. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          , call or text{" "}
          <a
            href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}
            className="text-primary hover:underline"
          >
            {SUPPORT_PHONE_DISPLAY}
          </a>
          , or visit our{" "}
          <a href="/contact" className="text-primary hover:underline">
            contact page
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
