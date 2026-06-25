import { SITE_URL } from "@/lib/landing-content";
import { PLATFORM_NAME } from "@/lib/brand";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export function LandingJsonLd() {
  const offers = SUBSCRIPTION_PLANS.flatMap((plan) => [
    {
      "@type": "Offer",
      name: `${plan.name} — Monthly`,
      price: (plan.monthly.ALL.amountCents / 100).toFixed(2),
      priceCurrency: "ALL",
      url: `${SITE_URL}/#pricing`,
    },
    {
      "@type": "Offer",
      name: `${plan.name} — Annual`,
      price: (plan.annual.ALL.amountCents / 100).toFixed(2),
      priceCurrency: "ALL",
      url: `${SITE_URL}/#pricing`,
    },
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: PLATFORM_NAME,
        description:
          "Premium fitness platform with workouts, nutrition, AI coaching, and live sessions.",
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: PLATFORM_NAME,
        url: SITE_URL,
        email: "redtocila@gmail.com",
      },
      {
        "@type": "SoftwareApplication",
        name: PLATFORM_NAME,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        offers,
        description:
          "Workout builder, nutrition tracking, AI coach, live coaching, and custom trainer plans.",
        url: SITE_URL,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
