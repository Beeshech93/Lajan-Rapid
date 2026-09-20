import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LocaleContentPage, hreflangLinks, type PageContent } from "@/lib/seo-page-helpers";

const CONTENT: Record<"es" | "fr" | "ht", PageContent> = {
  es: {
    title: "Cómo Enviar Dinero a Haití | Lajan Rapid",
    description:
      "Guía paso a paso para enviar dinero a Haití con Lajan Rapid: elige tu país, ingresa el monto, elige un método de pago, y sigue tu envío en tiempo real.",
    heading: "Cómo enviar dinero a Haití",
    intro:
      "Enviar dinero con Lajan Rapid toma unos pocos pasos simples, desde elegir tu país hasta confirmar que tu familia recibió el dinero.",
    sections: [
      {
        title: "Pasos",
        body: "",
        list: [
          "Selecciona el país desde donde quieres enviar.",
          "Introduce el importe que quieres enviar.",
          "Selecciona el método de pago disponible.",
          "Introduce los datos del beneficiario en Haití.",
          "Revisa la tarifa y el tipo de cambio antes de confirmar.",
          "Confirma la transferencia.",
          "Consulta el estado de tu operación en tiempo real.",
        ],
      },
      {
        title: "Estados de la transferencia",
        body: "Cada envío pasa por etapas reales y rastreables: Creado, Esperando pago, Pago confirmado, En proceso, Listo para retirar, y Entregado (o Cancelado si lo cancelas antes de pagar).",
      },
      {
        title: "Verificación de identidad (KYC)",
        body: "Antes de que se complete tu primer envío, necesitarás verificar tu identidad subiendo una foto de tu documento. Esto lo exige la regulación y solo se hace una vez.",
      },
    ],
    cta: "Enviar dinero",
  },
  fr: {
    title: "Comment Envoyer de l'Argent en Haïti | Lajan Rapid",
    description:
      "Guide étape par étape pour envoyer de l'argent en Haïti avec Lajan Rapid : choisissez votre pays, entrez le montant, choisissez un mode de paiement, et suivez votre envoi en temps réel.",
    heading: "Comment envoyer de l'argent en Haïti",
    intro:
      "Envoyer de l'argent avec Lajan Rapid ne prend que quelques étapes simples, du choix de votre pays à la confirmation que votre famille a bien reçu les fonds.",
    sections: [
      {
        title: "Étapes",
        body: "",
        list: [
          "Choisissez le pays depuis lequel vous envoyez.",
          "Entrez le montant que vous souhaitez envoyer.",
          "Choisissez un mode de paiement disponible.",
          "Entrez les informations du destinataire en Haïti.",
          "Vérifiez le taux de change et les frais avant de confirmer.",
          "Confirmez l'envoi.",
          "Suivez l'état de votre envoi en temps réel.",
        ],
      },
      {
        title: "Statut de l'envoi",
        body: "Chaque envoi passe par des étapes réelles et traçables : Créé, En attente de paiement, Paiement confirmé, En cours, Prêt à retirer, et Livré (ou Annulé si vous annulez avant paiement).",
      },
      {
        title: "Vérification d'identité (KYC)",
        body: "Avant que votre premier envoi ne soit finalisé, vous devrez vérifier votre identité en téléchargeant une photo de votre pièce d'identité. C'est une exigence réglementaire, à faire une seule fois.",
      },
    ],
    cta: "Envoyer de l'argent",
  },
  ht: {
    title: "Kijan pou Voye Lajan an Ayiti | Lajan Rapid",
    description:
      "Gid etap pa etap pou voye lajan an Ayiti ak Lajan Rapid: chwazi peyi w, antre montan an, chwazi yon metòd peman, epi swiv voyaj ou an tan reyèl.",
    heading: "Kijan pou voye lajan an Ayiti",
    intro:
      "Voye lajan ak Lajan Rapid pran sèlman kèk etap senp, soti nan chwazi peyi w rive nan konfime fanmi w resevwa lajan an.",
    sections: [
      {
        title: "Etap yo",
        body: "",
        list: [
          "Chwazi peyi kote w ap voye a soti.",
          "Antre montan ou vle voye a.",
          "Chwazi yon metòd peman ki disponib.",
          "Antre enfòmasyon destinatè a an Ayiti.",
          "Tcheke to chanj lan ak frè a anvan w konfime.",
          "Konfime voyaj la.",
          "Swiv estati voyaj ou an tan reyèl.",
        ],
      },
      {
        title: "Estati voyaj la",
        body: "Chak voyaj pase nan etap reyèl ou ka swiv: Kreye, Ap tann peman, Peman konfime, Ap trete, Pare pou retire, ak Livre (oswa Anile si w anile anvan li peye).",
      },
      {
        title: "Verifikasyon idantite (KYC)",
        body: "Anvan premye voyaj ou fini, w ap bezwen verifye idantite w lè w telechaje yon foto dokiman idantite w. Sa se yon egzijans regilasyon, se yon sèl fwa pou w fè l.",
      },
    ],
    cta: "Voye lajan",
  },
};

export const Route = createFileRoute("/$lang/como-enviar-dinero")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/como-enviar-dinero" });
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
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/como-enviar-dinero` },
        ...hreflangLinks("como-enviar-dinero"),
      ],
    };
  },
  component: LocaleComoEnviarDinero,
});

function LocaleComoEnviarDinero() {
  const { lang } = Route.useParams();
  return <LocaleContentPage urlLang={lang} content={CONTENT[lang as "es" | "fr" | "ht"]} />;
}
