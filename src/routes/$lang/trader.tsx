import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { TraderPage } from "@/routes/trader";
import { useI18n } from "@/lib/i18n";

const CONTENT: Record<
  "es" | "fr" | "ht",
  {
    title: string;
    description: string;
    heading: string;
    subheading: string;
    howTitle: string;
    steps: string[];
    assetsTitle: string;
    cta: string;
  }
> = {
  es: {
    title: "Retira tu criptomoneda a MonCash y NatCash | Lajan Rapid",
    description:
      "Traders y tenedores de criptomonedas pueden retirar BTC, USDT y USDC directo a MonCash o NatCash en Haití con Lajan Rapid.",
    heading: "Retira tu criptomoneda a MonCash o NatCash",
    subheading:
      "Para traders y tenedores de cripto en Haití: retira BTC, USDT o USDC directo a tu billetera MonCash o NatCash — sin pasar por un exchange externo.",
    howTitle: "Cómo funciona",
    steps: [
      "Regístrate y verifica tu identidad (KYC).",
      "Entra a la sección Cripto y elige el activo (BTC, USDT o USDC) y la red.",
      "Solicita un retiro a MonCash o NatCash, indicando el número de teléfono que recibe.",
      "Confirma la tasa de cambio y la comisión, y confirma el retiro.",
      "El dinero llega a la billetera MonCash o NatCash del destinatario.",
    ],
    assetsTitle: "Activos soportados",
    cta: "Abrir mi cuenta",
  },
  fr: {
    title: "Retirez vos cryptomonnaies vers MonCash et NatCash | Lajan Rapid",
    description:
      "Les traders et détenteurs de cryptomonnaies peuvent retirer BTC, USDT et USDC directement vers MonCash ou NatCash en Haïti avec Lajan Rapid.",
    heading: "Retirez vos cryptomonnaies vers MonCash ou NatCash",
    subheading:
      "Pour les traders et détenteurs de crypto en Haïti : retirez BTC, USDT ou USDC directement vers votre portefeuille MonCash ou NatCash — sans passer par un exchange externe.",
    howTitle: "Comment ça marche",
    steps: [
      "Inscrivez-vous et vérifiez votre identité (KYC).",
      "Allez dans la section Crypto et choisissez l'actif (BTC, USDT ou USDC) et le réseau.",
      "Demandez un retrait vers MonCash ou NatCash en indiquant le numéro de téléphone destinataire.",
      "Confirmez le taux de change et les frais, puis confirmez le retrait.",
      "Les fonds arrivent sur le portefeuille MonCash ou NatCash du destinataire.",
    ],
    assetsTitle: "Actifs pris en charge",
    cta: "Ouvrir mon compte",
  },
  ht: {
    title: "Retire kriptomone ou nan MonCash ak NatCash | Lajan Rapid",
    description:
      "Trader ak moun ki gen kriptomone ka retire BTC, USDT ak USDC dirèkteman nan MonCash oswa NatCash an Ayiti ak Lajan Rapid.",
    heading: "Retire kriptomone ou nan MonCash oswa NatCash",
    subheading:
      "Pou trader ak moun ki gen kripto an Ayiti: retire BTC, USDT oswa USDC dirèkteman nan bous MonCash oswa NatCash ou — san w pa pase pa yon exchange deyò.",
    howTitle: "Kijan sa mache",
    steps: [
      "Enskri epi verifye idantite w (KYC).",
      "Ale nan seksyon Kripto epi chwazi aktif la (BTC, USDT oswa USDC) ak rezo a.",
      "Mande yon retrè nan MonCash oswa NatCash, mete nimewo telefòn ki pral resevwa a.",
      "Konfime to chanj lan ak frè a, epi konfime retrè a.",
      "Lajan an rive nan bous MonCash oswa NatCash destinatè a.",
    ],
    assetsTitle: "Aktif ki sipòte",
    cta: "Louvri kont mwen",
  },
};

export const Route = createFileRoute("/$lang/trader")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/trader" });
    if (params.lang !== "es" && params.lang !== "fr" && params.lang !== "ht") throw notFound();
  },
  head: ({ params }) => {
    const lang = params.lang as "es" | "fr" | "ht";
    const c = CONTENT[lang];
    const base = "https://lajanrapid.app";
    return {
      meta: [
        { title: c.title },
        { name: "description", content: c.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: c.title },
        { property: "og:description", content: c.description },
      ],
      links: [
        { rel: "canonical", href: `${base}/${lang}/trader` },
        { rel: "alternate", hreflang: "en", href: `${base}/trader` },
        { rel: "alternate", hreflang: "es", href: `${base}/es/trader` },
        { rel: "alternate", hreflang: "fr", href: `${base}/fr/trader` },
        { rel: "alternate", hreflang: "ht", href: `${base}/ht/trader` },
        { rel: "alternate", hreflang: "x-default", href: `${base}/trader` },
      ],
    };
  },
  component: LocaleTrader,
});

function LocaleTrader() {
  const { lang: urlLang } = Route.useParams();
  const { lang, setLang } = useI18n();
  const c = CONTENT[urlLang as "es" | "fr" | "ht"];

  useEffect(() => {
    if (urlLang !== lang && (urlLang === "es" || urlLang === "fr" || urlLang === "ht")) {
      setLang(urlLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);

  return (
    <TraderPage
      heading={c.heading}
      subheading={c.subheading}
      howTitle={c.howTitle}
      steps={c.steps}
      assetsTitle={c.assetsTitle}
      cta={c.cta}
    />
  );
}
