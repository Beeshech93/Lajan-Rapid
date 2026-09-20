import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "About Us | Lajan Rapid",
  description:
    "Lajan Rapid is a money transfer platform focused on making it easier to send money to Haiti, with transparent fees and real-time tracking.",
  heading: "About Lajan Rapid",
  intro:
    "Lajan Rapid is a platform designed to facilitate money transfers to Haiti, from the countries and payment methods currently available on our platform.",
  sections: [
    {
      title: "What we offer",
      body: "",
      list: [
        "Transparent fees and exchange rates shown before you confirm",
        "Real-time transfer tracking",
        "Identity verification (KYC) to keep transfers secure",
        "Mobile top-ups for phones in Haiti and other countries",
        "Crypto withdrawals to MonCash and NatCash for traders and crypto holders",
      ],
    },
    {
      title: "Availability",
      body: "The countries, payment methods, and receiving options available depend on what's currently enabled on the platform. We don't claim availability where the service isn't actually active.",
    },
  ],
  cta: "Create an account",
};

export const Route = createFileRoute("/sobre-nosotros")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/sobre-nosotros" },
      ...hreflangLinks("sobre-nosotros"),
    ],
  }),
  component: () => (
    <ContentPage
      heading={CONTENT.heading}
      intro={CONTENT.intro}
      sections={CONTENT.sections}
      cta={CONTENT.cta}
    />
  ),
});
