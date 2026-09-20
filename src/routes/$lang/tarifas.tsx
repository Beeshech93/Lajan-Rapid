import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LocaleContentPage, hreflangLinks, type PageContent } from "@/lib/seo-page-helpers";

const CONTENT: Record<"es" | "fr" | "ht", PageContent> = {
  es: {
    title: "Tarifas | Lajan Rapid",
    description:
      "Consulta exactamente cuánto pagas al enviar dinero a Haití con Lajan Rapid: tipo de cambio, comisión, y el monto exacto que recibe tu familia, antes de confirmar.",
    heading: "Tarifas transparentes",
    intro:
      "Lajan Rapid te muestra el tipo de cambio, la comisión, y el monto exacto que va a recibir tu destinatario antes de confirmar cualquier envío — sin costos ocultos.",
    sections: [
      {
        title: "Lo que ves antes de confirmar",
        body: "",
        list: [
          "El monto que envías",
          "La comisión de ese envío",
          "El tipo de cambio aplicado",
          "El monto exacto que recibe tu destinatario, en la moneda local",
        ],
      },
      {
        title: "Por qué la tarifa puede variar",
        body: "La tarifa depende del país desde donde envías, el método de pago que elijas, y el tipo de cambio vigente. Por eso el desglose final siempre se calcula en vivo antes de confirmar — nunca se estima de antemano.",
      },
    ],
    cta: "Calcular un envío",
  },
  fr: {
    title: "Frais | Lajan Rapid",
    description:
      "Consultez exactement ce que vous payez pour envoyer de l'argent en Haïti avec Lajan Rapid : taux de change, frais, et le montant exact que votre famille reçoit, avant de confirmer.",
    heading: "Frais transparents",
    intro:
      "Lajan Rapid affiche le taux de change, les frais, et le montant exact que votre destinataire recevra avant que vous ne confirmiez un envoi — sans coûts cachés.",
    sections: [
      {
        title: "Ce que vous voyez avant de confirmer",
        body: "",
        list: [
          "Le montant que vous envoyez",
          "Les frais de cet envoi",
          "Le taux de change appliqué",
          "Le montant exact que reçoit votre destinataire, en monnaie locale",
        ],
      },
      {
        title: "Pourquoi les frais peuvent varier",
        body: "Les frais dépendent du pays depuis lequel vous envoyez, du mode de paiement choisi, et du taux de change en vigueur. C'est pourquoi le détail final est toujours calculé en direct avant confirmation — jamais estimé à l'avance.",
      },
    ],
    cta: "Calculer un envoi",
  },
  ht: {
    title: "Frè | Lajan Rapid",
    description:
      "Gade egzakteman konbyen w peye lè w voye lajan an Ayiti ak Lajan Rapid: to chanj, frè, ak montan egzak fanmi w resevwa, anvan w konfime.",
    heading: "Frè transparan",
    intro:
      "Lajan Rapid montre w to chanj lan, frè a, ak montan egzak destinatè w ap resevwa anvan w konfime nenpòt voyaj — san okenn kòt kache.",
    sections: [
      {
        title: "Sa w wè anvan w konfime",
        body: "",
        list: [
          "Montan w ap voye a",
          "Frè voyaj sa a",
          "To chanj ki aplike a",
          "Montan egzak destinatè w ap resevwa a, nan lajan lokal la",
        ],
      },
      {
        title: "Poukisa frè a ka chanje",
        body: "Frè a depann de peyi kote w ap voye soti a, metòd peman w chwazi a, ak to chanj ki aktyèl la. Se poutèt sa detay final la toujou kalkile an dirèk anvan w konfime — li pa janm estime davans.",
      },
    ],
    cta: "Kalkile yon voyaj",
  },
};

export const Route = createFileRoute("/$lang/tarifas")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/tarifas" });
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
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/tarifas` },
        ...hreflangLinks("tarifas"),
      ],
    };
  },
  component: LocaleTarifas,
});

function LocaleTarifas() {
  const { lang } = Route.useParams();
  return <LocaleContentPage urlLang={lang} content={CONTENT[lang as "es" | "fr" | "ht"]} />;
}
