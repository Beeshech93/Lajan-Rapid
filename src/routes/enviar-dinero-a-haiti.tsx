import { createFileRoute, Link } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "Send Money to Haiti | Lajan Rapid",
  description:
    "Find out how to send money to Haiti with Lajan Rapid: available countries, payment methods, receiving options, fees, and tracking.",
  heading: "Send money to Haiti",
  intro:
    "Lajan Rapid is a platform designed to make transfers to Haiti easier. Availability of each country, payment method, and receiving method depends on what's currently enabled on the platform.",
  sections: [
    {
      title: "Countries available to send from",
      body: "Mexico (card, OXXO, SPEI, or Mercado Pago), and by card only from the United States, Canada, Brazil, Spain, France, Germany, Italy, Portugal, the Netherlands, Belgium, Switzerland, and the United Kingdom.",
    },
    {
      title: "Receiving methods in Haiti",
      body: "",
      list: ["MonCash", "NatCash"],
    },
    {
      title: "Fees",
      body: "You always see the exchange rate, fee, and exact amount your recipient will get before confirming.",
    },
    {
      title: "Tracking",
      body: "Every transfer moves through real, trackable stages, from creation to delivery.",
    },
  ],
  cta: "Send money now",
};

export const Route = createFileRoute("/enviar-dinero-a-haiti")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/enviar-dinero-a-haiti" },
      ...hreflangLinks("enviar-dinero-a-haiti"),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Send Money to Haiti — Lajan Rapid",
          serviceType: "Money transfer",
          provider: { "@type": "Organization", name: "Lajan Rapid" },
          areaServed: "Haiti",
        }),
      },
    ],
  }),
  component: () => (
    <>
      <ContentPage
        heading={CONTENT.heading}
        intro={CONTENT.intro}
        sections={CONTENT.sections}
        cta={CONTENT.cta}
      />
      <p className="mx-auto -mt-10 max-w-3xl px-5 pb-16 text-sm text-muted-foreground">
        Learn more:{" "}
        <Link to="/como-enviar-dinero" className="underline">
          how to send money
        </Link>
        ,{" "}
        <Link to="/tarifas" className="underline">
          fees
        </Link>
        ,{" "}
        <Link to="/moncash" className="underline">
          MonCash
        </Link>
        ,{" "}
        <Link to="/natcash" className="underline">
          NatCash
        </Link>
        , or read our{" "}
        <Link to="/faq" className="underline">
          FAQ
        </Link>
        .
      </p>
    </>
  ),
});
