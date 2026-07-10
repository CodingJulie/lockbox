import { getSiteUrl } from "@/lib/site";

export default function JsonLd() {
  const siteUrl = getSiteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Lockbox",
    alternateName: "Локбокс",
    url: siteUrl,
    description:
      "Secure cloud storage for storing evidence without registration. One unique access code.",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    inLanguage: ["ru", "en"],
    browserRequirements: "Requires JavaScript. Requires HTML5.",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
