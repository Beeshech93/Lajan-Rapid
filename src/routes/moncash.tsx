import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "Send Money to MonCash | Lajan Rapid",
  description:
    "Send money to Haiti and have it delivered directly to a MonCash mobile wallet with Lajan Rapid.",
  heading: "Send money to MonCash",
  intro:
    "MonCash is one of the delivery methods available on Lajan Rapid. Choose it as the receiving option when you send money to Haiti, and the funds go straight to the recipient's MonCash mobile wallet.",
  sections: [
    {
      title: "What you need",
      body: "The recipient's MonCash-registered mobile number in Haiti. That's it — no bank account required.",
    },
    {
      title: "How it works with Lajan Rapid",
      body: "When creating your transfer, select MonCash as the delivery method and enter the recipient's phone number. Once your payment is confirmed, the transfer is processed and the funds are sent to that MonCash wallet.",
    },
  ],
  cta: "Send to MonCash",
};

export const Route = createFileRoute("/moncash")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/moncash" },
      ...hreflangLinks("moncash"),
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
