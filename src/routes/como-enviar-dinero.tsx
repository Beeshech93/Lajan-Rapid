import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const CONTENT = {
  title: "How to Send Money to Haiti | Lajan Rapid",
  description:
    "Step-by-step guide to sending money to Haiti with Lajan Rapid: choose a country, enter the amount, pick a payment method, and track your transfer in real time.",
  heading: "How to send money to Haiti",
  intro:
    "Sending money with Lajan Rapid takes a few simple steps, from choosing your country to confirming that your family received the funds.",
  sections: [
    {
      title: "Steps",
      body: "",
      list: [
        "Choose the country you're sending from.",
        "Enter the amount you want to send.",
        "Choose an available payment method.",
        "Enter the recipient's details in Haiti.",
        "Review the exchange rate and fee before confirming.",
        "Confirm the transfer.",
        "Track the status of your transfer in real time.",
      ],
    },
    {
      title: "Transfer status",
      body: "Every transfer moves through real, trackable stages: Created, Awaiting payment, Paid, Processing, Ready for pickup, and Completed (or Cancelled if you cancel before it's paid).",
    },
    {
      title: "Identity verification (KYC)",
      body: "Before your first transfer completes, you'll need to verify your identity by uploading a photo ID. This is required by regulation and only needs to be done once.",
    },
  ],
  cta: "Send money",
};

export const Route = createFileRoute("/como-enviar-dinero")({
  head: () => ({
    meta: [
      { title: CONTENT.title },
      { name: "description", content: CONTENT.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: CONTENT.title },
      { property: "og:description", content: CONTENT.description },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/como-enviar-dinero" },
      ...hreflangLinks("como-enviar-dinero"),
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
