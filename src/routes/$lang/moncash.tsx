import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LocaleContentPage, hreflangLinks, type PageContent } from "@/lib/seo-page-helpers";

const CONTENT: Record<"es" | "fr" | "ht", PageContent> = {
  es: {
    title: "Enviar Dinero a MonCash | Lajan Rapid",
    description:
      "Envía dinero a Haití y recíbelo directo en una billetera MonCash con Lajan Rapid.",
    heading: "Enviar dinero a MonCash",
    intro:
      "MonCash es uno de los métodos de entrega disponibles en Lajan Rapid. Elígelo como opción de recepción al enviar dinero a Haití, y el dinero llega directo a la billetera móvil MonCash del destinatario.",
    sections: [
      {
        title: "Lo que necesitas",
        body: "El número de teléfono registrado en MonCash del destinatario en Haití. Nada más — no se necesita cuenta bancaria.",
      },
      {
        title: "Cómo funciona con Lajan Rapid",
        body: "Al crear tu envío, selecciona MonCash como método de entrega e introduce el número de teléfono del destinatario. Una vez confirmado tu pago, el envío se procesa y el dinero se envía a esa billetera MonCash.",
      },
    ],
    cta: "Enviar a MonCash",
  },
  fr: {
    title: "Envoyer de l'Argent vers MonCash | Lajan Rapid",
    description:
      "Envoyez de l'argent en Haïti et recevez-le directement sur un portefeuille MonCash avec Lajan Rapid.",
    heading: "Envoyer de l'argent vers MonCash",
    intro:
      "MonCash est l'un des modes de réception disponibles sur Lajan Rapid. Choisissez-le comme option de réception lorsque vous envoyez de l'argent en Haïti, et les fonds arrivent directement sur le portefeuille mobile MonCash du destinataire.",
    sections: [
      {
        title: "Ce dont vous avez besoin",
        body: "Le numéro de téléphone enregistré sur MonCash du destinataire en Haïti. C'est tout — aucun compte bancaire requis.",
      },
      {
        title: "Comment ça marche avec Lajan Rapid",
        body: "En créant votre envoi, sélectionnez MonCash comme mode de réception et entrez le numéro de téléphone du destinataire. Une fois votre paiement confirmé, l'envoi est traité et les fonds sont envoyés vers ce portefeuille MonCash.",
      },
    ],
    cta: "Envoyer vers MonCash",
  },
  ht: {
    title: "Voye Lajan nan MonCash | Lajan Rapid",
    description:
      "Voye lajan an Ayiti epi resevwa l dirèkteman nan yon bous MonCash ak Lajan Rapid.",
    heading: "Voye lajan nan MonCash",
    intro:
      "MonCash se youn nan metòd livrezon ki disponib nan Lajan Rapid. Chwazi l kòm opsyon resepsyon lè w voye lajan an Ayiti, epi lajan an rive dirèkteman nan bous mobil MonCash destinatè a.",
    sections: [
      {
        title: "Sa w bezwen",
        body: "Nimewo telefòn destinatè a ki anrejistre nan MonCash an Ayiti. Se sa sèlman — pa gen bezwen kont bank.",
      },
      {
        title: "Kijan sa mache ak Lajan Rapid",
        body: "Lè w ap kreye voyaj ou, chwazi MonCash kòm metòd livrezon epi antre nimewo telefòn destinatè a. Yon fwa peman w konfime, voyaj la trete epi lajan an voye nan bous MonCash sa a.",
      },
    ],
    cta: "Voye nan MonCash",
  },
};

export const Route = createFileRoute("/$lang/moncash")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/moncash" });
    if (params.lang !== "es" && params.lang !== "fr" && params.lang !== "ht") throw notFound();
  },
  head: ({ params }) => {
    const lang = params.lang as "es" | "fr" | "ht";
    const c = CONTENT[lang];
    return {
      meta: [
        { title: c.title },
        { name: "description", content: c.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: c.title },
        { property: "og:description", content: c.description },
      ],
      links: [
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/moncash` },
        ...hreflangLinks("moncash"),
      ],
    };
  },
  component: LocaleMoncash,
});

function LocaleMoncash() {
  const { lang } = Route.useParams();
  return <LocaleContentPage urlLang={lang} content={CONTENT[lang as "es" | "fr" | "ht"]} />;
}
