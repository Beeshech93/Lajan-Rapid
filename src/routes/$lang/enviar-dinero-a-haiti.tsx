import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { LocaleContentPage, hreflangLinks, type PageContent } from "@/lib/seo-page-helpers";

const CONTENT: Record<"es" | "fr" | "ht", PageContent> = {
  es: {
    title: "Enviar Dinero a Haití | Lajan Rapid",
    description:
      "Descubre cómo enviar dinero a Haití con Lajan Rapid: países disponibles, métodos de pago, opciones de recepción, tarifas y seguimiento.",
    heading: "Enviar dinero a Haití",
    intro:
      "Lajan Rapid es una plataforma diseñada para facilitar transferencias hacia Haití. La disponibilidad de cada país, método de pago y método de recepción depende de las opciones habilitadas en la plataforma.",
    sections: [
      {
        title: "Países desde donde puedes enviar",
        body: "México (tarjeta, OXXO, SPEI o Mercado Pago), y solo con tarjeta desde Estados Unidos, Canadá, Brasil, España, Francia, Alemania, Italia, Portugal, Países Bajos, Bélgica, Suiza y Reino Unido.",
      },
      { title: "Métodos de recepción en Haití", body: "", list: ["MonCash", "NatCash"] },
      {
        title: "Tarifas",
        body: "Siempre ves el tipo de cambio, la comisión, y el monto exacto que va a recibir tu destinatario antes de confirmar.",
      },
      {
        title: "Seguimiento",
        body: "Cada envío pasa por etapas reales y rastreables, desde su creación hasta la entrega.",
      },
    ],
    cta: "Enviar dinero ahora",
  },
  fr: {
    title: "Envoyer de l'Argent en Haïti | Lajan Rapid",
    description:
      "Découvrez comment envoyer de l'argent en Haïti avec Lajan Rapid : pays disponibles, modes de paiement, options de réception, frais et suivi.",
    heading: "Envoyer de l'argent en Haïti",
    intro:
      "Lajan Rapid est une plateforme conçue pour faciliter les transferts vers Haïti. La disponibilité de chaque pays, mode de paiement et mode de réception dépend des options activées sur la plateforme.",
    sections: [
      {
        title: "Pays depuis lesquels vous pouvez envoyer",
        body: "Mexique (carte, OXXO, SPEI ou Mercado Pago), et par carte uniquement depuis les États-Unis, le Canada, le Brésil, l'Espagne, la France, l'Allemagne, l'Italie, le Portugal, les Pays-Bas, la Belgique, la Suisse et le Royaume-Uni.",
      },
      { title: "Modes de réception en Haïti", body: "", list: ["MonCash", "NatCash"] },
      {
        title: "Frais",
        body: "Vous voyez toujours le taux de change, les frais, et le montant exact que recevra votre destinataire avant de confirmer.",
      },
      {
        title: "Suivi",
        body: "Chaque envoi passe par des étapes réelles et traçables, de sa création jusqu'à la livraison.",
      },
    ],
    cta: "Envoyer de l'argent maintenant",
  },
  ht: {
    title: "Voye Lajan an Ayiti | Lajan Rapid",
    description:
      "Dekouvri kijan pou voye lajan an Ayiti ak Lajan Rapid: peyi ki disponib, metòd peman, opsyon resepsyon, frè, ak swiv.",
    heading: "Voye lajan an Ayiti",
    intro:
      "Lajan Rapid se yon platfòm ki fèt pou fasilite transfè vè Ayiti. Disponiblite chak peyi, metòd peman, ak metòd resepsyon depann de opsyon ki aktive sou platfòm lan.",
    sections: [
      {
        title: "Peyi kote w ka voye soti",
        body: "Meksik (kat, OXXO, SPEI oswa Mercado Pago), epi sèlman ak kat soti nan Etazini, Kanada, Brezil, Espay, Frans, Almay, Itali, Pòtigal, Peyi Ba, Bèljik, Swis, ak Wayòm Ini.",
      },
      { title: "Metòd resepsyon an Ayiti", body: "", list: ["MonCash", "NatCash"] },
      {
        title: "Frè",
        body: "Ou toujou wè to chanj lan, frè a, ak montan egzak destinatè w ap resevwa a anvan w konfime.",
      },
      {
        title: "Swiv",
        body: "Chak voyaj pase nan etap reyèl ou ka swiv, soti nan kreyasyon l rive nan livrezon l.",
      },
    ],
    cta: "Voye lajan kounye a",
  },
};

export const Route = createFileRoute("/$lang/enviar-dinero-a-haiti")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/enviar-dinero-a-haiti" });
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
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/enviar-dinero-a-haiti` },
        ...hreflangLinks("enviar-dinero-a-haiti"),
      ],
    };
  },
  component: LocaleEnviarDineroAHaiti,
});

function LocaleEnviarDineroAHaiti() {
  const { lang } = Route.useParams();
  return (
    <>
      <LocaleContentPage urlLang={lang} content={CONTENT[lang as "es" | "fr" | "ht"]} />
      <p className="mx-auto -mt-10 max-w-3xl px-5 pb-16 text-sm text-muted-foreground">
        <Link to="/$lang/como-enviar-dinero" params={{ lang }} className="underline">
          {lang === "es" ? "Cómo enviar" : lang === "fr" ? "Comment envoyer" : "Kijan pou voye"}
        </Link>
        {" · "}
        <Link to="/$lang/tarifas" params={{ lang }} className="underline">
          {lang === "es" ? "Tarifas" : lang === "fr" ? "Frais" : "Frè"}
        </Link>
        {" · "}
        <Link to="/$lang/moncash" params={{ lang }} className="underline">
          MonCash
        </Link>
        {" · "}
        <Link to="/$lang/natcash" params={{ lang }} className="underline">
          NatCash
        </Link>
      </p>
    </>
  );
}
