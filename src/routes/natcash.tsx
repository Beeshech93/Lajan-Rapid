import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "Send Money to NatCash | Lajan Rapid",
  description:
    "Send money to Haiti and have it delivered directly to a NatCash mobile wallet with Lajan Rapid.",
  heading: "Send money to NatCash",
  intro:
    "NatCash is one of the delivery methods available on Lajan Rapid. Choose it as the receiving option when you send money to Haiti, and the funds go straight to the recipient's NatCash mobile wallet.",
  sections: [
    {
      title: "What you need",
      body: "The recipient's NatCash-registered mobile number in Haiti. That's it — no bank account required.",
    },
    {
      title: "How it works with Lajan Rapid",
      body: "When creating your transfer, select NatCash as the delivery method and enter the recipient's phone number. Once your payment is confirmed, the transfer is processed and the funds are sent to that NatCash wallet.",
    },
  ],
  cta: "Send to NatCash",
};

export const Route = createFileRoute("/natcash")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/natcash" },
      ...hreflangLinks("natcash"),
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
