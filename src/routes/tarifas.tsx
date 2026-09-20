import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "Fees | Lajan Rapid",
  description:
    "See exactly what you pay to send money to Haiti with Lajan Rapid: exchange rate, fee, and the exact amount your family receives, before you confirm.",
  heading: "Transparent fees",
  intro:
    "Lajan Rapid shows the exchange rate, fee, and the exact amount your recipient will receive before you confirm any transfer — no hidden costs.",
  sections: [
    {
      title: "What you see before confirming",
      body: "",
      list: [
        "The amount you send",
        "The fee for that transfer",
        "The exchange rate applied",
        "The exact amount your recipient receives, in the local currency",
      ],
    },
    {
      title: "Why fees can vary",
      body: "Fees depend on the country you're sending from, the payment method you choose, and the current exchange rate. That's why the final breakdown is always calculated live before you confirm — never guessed in advance.",
    },
  ],
  cta: "Calculate a transfer",
};

export const Route = createFileRoute("/tarifas")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/tarifas" },
      ...hreflangLinks("tarifas"),
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
