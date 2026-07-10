import type { Metadata } from "next";
import { Toaster } from "@/components/ui/Sonner";
import Providers from "@/app/providers";
import I18nProvider from "@/components/providers/I18nProvider";
import JsonLd from "@/components/seo/JsonLd";
import { fontHeading, fontMono, fontSans } from "@/lib/fonts";
import { getSiteUrl, ogImage } from "@/lib/site";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lockbox — Secure Cloud Storage | Локбокс",
    template: "%s | Lockbox",
  },
  description:
    "Store evidence in the cloud without registration. One unique code — full access. Безопасное облачное хранилище без регистрации.",
  keywords: [
    "secure storage",
    "cloud storage",
    "evidence",
    "privacy",
    "no registration",
    "безопасное хранилище",
    "облачное хранилище",
    "доказательства",
    "конфиденциальность",
  ],
  authors: [{ name: "Lockbox" }],
  creator: "Lockbox",
  publisher: "Lockbox",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
    url: siteUrl,
    siteName: "Lockbox / Локбокс",
    title: "Lockbox — Secure Cloud Storage",
    description: "Private cloud storage. No registration. One unique access code.",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lockbox — Secure Cloud Storage",
    description: "Private cloud storage. No registration. One unique access code.",
    images: [ogImage.url],
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      ru: siteUrl,
      en: siteUrl,
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lockbox",
  },
  formatDetection: {
    telephone: false,
  },
  category: "security",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#dc2626" />
        <meta name="mobile-web-app-capable" content="yes" />
        <JsonLd />
      </head>
      <body
        className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} bg-background min-h-screen font-sans antialiased`}
      >
        <I18nProvider>
          <Providers>
            {children}
            <Toaster richColors position="top-center" />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
