import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LocaleContentPage, hreflangLinks, type PageContent } from "@/lib/seo-page-helpers";

const CONTENT: Record<"es" | "fr" | "ht", PageContent> = {
  es: {
    title: "Sobre Nosotros | Lajan Rapid",
    description:
      "Lajan Rapid es una plataforma de envío de dinero enfocada en facilitar el envío hacia Haití, con tarifas transparentes y seguimiento en tiempo real.",
    heading: "Sobre Lajan Rapid",
    intro:
      "Lajan Rapid es una plataforma diseñada para facilitar transferencias de dinero hacia Haití, desde los países y métodos de pago actualmente disponibles en nuestra plataforma.",
    sections: [
      {
        title: "Lo que ofrecemos",
        body: "",
        list: [
          "Tarifas y tipos de cambio transparentes, mostrados antes de confirmar",
          "Seguimiento de envíos en tiempo real",
          "Verificación de identidad (KYC) para mantener los envíos seguros",
          "Recargas de saldo móvil para teléfonos en Haití y otros países",
          "Retiro de criptomonedas a MonCash y NatCash para traders y tenedores de cripto",
        ],
      },
      {
        title: "Disponibilidad",
        body: "Los países, métodos de pago y opciones de recepción disponibles dependen de lo que esté habilitado actualmente en la plataforma. No afirmamos disponibilidad donde el servicio no está realmente activo.",
      },
    ],
    cta: "Crear una cuenta",
  },
  fr: {
    title: "À Propos | Lajan Rapid",
    description:
      "Lajan Rapid est une plateforme de transfert d'argent dédiée à faciliter l'envoi d'argent en Haïti, avec des frais transparents et un suivi en temps réel.",
    heading: "À propos de Lajan Rapid",
    intro:
      "Lajan Rapid est une plateforme conçue pour faciliter les transferts d'argent vers Haïti, depuis les pays et modes de paiement actuellement disponibles sur notre plateforme.",
    sections: [
      {
        title: "Ce que nous offrons",
        body: "",
        list: [
          "Frais et taux de change transparents, affichés avant confirmation",
          "Suivi des envois en temps réel",
          "Vérification d'identité (KYC) pour sécuriser les envois",
          "Recharges de crédit mobile pour les téléphones en Haïti et d'autres pays",
          "Retraits de cryptomonnaies vers MonCash et NatCash pour les traders et détenteurs de crypto",
        ],
      },
      {
        title: "Disponibilité",
        body: "Les pays, modes de paiement et options de réception disponibles dépendent de ce qui est actuellement activé sur la plateforme. Nous n'affirmons pas de disponibilité là où le service n'est pas réellement actif.",
      },
    ],
    cta: "Créer un compte",
  },
  ht: {
    title: "Konsènan Nou | Lajan Rapid",
    description:
      "Lajan Rapid se yon platfòm transfè lajan ki konsantre sou fasilite voye lajan an Ayiti, ak frè transparan ak swiv an tan reyèl.",
    heading: "Konsènan Lajan Rapid",
    intro:
      "Lajan Rapid se yon platfòm ki fèt pou fasilite transfè lajan vè Ayiti, soti nan peyi ak metòd peman ki disponib kounye a sou platfòm nou an.",
    sections: [
      {
        title: "Sa nou ofri",
        body: "",
        list: [
          "Frè ak to chanj transparan, montre anvan w konfime",
          "Swiv voyaj an tan reyèl",
          "Verifikasyon idantite (KYC) pou kenbe voyaj yo an sekirite",
          "Rechaj kredi mobil pou telefòn an Ayiti ak lòt peyi",
          "Retrè kriptomone nan MonCash ak NatCash pou trader ak moun ki gen kripto",
        ],
      },
      {
        title: "Disponiblite",
        body: "Peyi, metòd peman, ak opsyon resepsyon ki disponib depann de sa ki aktive kounye a sou platfòm lan. Nou pa afime disponiblite kote sèvis la pa reyèlman aktif.",
      },
    ],
    cta: "Kreye yon kont",
  },
};

export const Route = createFileRoute("/$lang/sobre-nosotros")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/sobre-nosotros" });
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
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/sobre-nosotros` },
        ...hreflangLinks("sobre-nosotros"),
      ],
    };
  },
  component: LocaleSobreNosotros,
});

function LocaleSobreNosotros() {
  const { lang } = Route.useParams();
  return <LocaleContentPage urlLang={lang} content={CONTENT[lang as "es" | "fr" | "ht"]} />;
}
