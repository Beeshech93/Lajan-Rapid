import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { Landing } from "@/routes/index";
import { useI18n } from "@/lib/i18n";

const SEO_META: Record<
  "es" | "fr" | "ht",
  { title: string; description: string; ogTitle: string; ogDescription: string }
> = {
  es: {
    title: "Lajan Rapid | Envía Dinero a Haití desde Diferentes Países",
    description:
      "Envía dinero a Haití de forma sencilla con Lajan Rapid. Consulta métodos disponibles, tarifas y opciones de recepción para beneficiarios en Haití.",
    ogTitle: "Lajan Rapid | Envía Dinero a Haití desde Diferentes Países",
    ogDescription:
      "Envía dinero a Haití de forma sencilla con Lajan Rapid. Consulta métodos disponibles, tarifas y opciones de recepción para beneficiarios en Haití.",
  },
  fr: {
    title: "Lajan Rapid | Envoyez de l'argent en Haïti depuis différents pays",
    description:
      "Envoyez de l'argent en Haïti facilement avec Lajan Rapid. Consultez les méthodes disponibles, les frais et les options de réception pour vos bénéficiaires en Haïti.",
    ogTitle: "Lajan Rapid | Envoyez de l'argent en Haïti depuis différents pays",
    ogDescription:
      "Envoyez de l'argent en Haïti facilement avec Lajan Rapid. Consultez les méthodes disponibles, les frais et les options de réception pour vos bénéficiaires en Haïti.",
  },
  ht: {
    title: "Lajan Rapid | Voye Lajan an Ayiti soti nan plizyè peyi",
    description:
      "Voye lajan an Ayiti fasilman ak Lajan Rapid. Gade metòd ki disponib, frè, ak opsyon resepsyon pou moun k ap resevwa yo an Ayiti.",
    ogTitle: "Lajan Rapid | Voye Lajan an Ayiti soti nan plizyè peyi",
    ogDescription:
      "Voye lajan an Ayiti fasilman ak Lajan Rapid. Gade metòd ki disponib, frè, ak opsyon resepsyon pou moun k ap resevwa yo an Ayiti.",
  },
};

export const Route = createFileRoute("/$lang/")({
  beforeLoad: ({ params }) => {
    // "/en" no genera una página aparte — la raíz "/" ya es la versión en
    // inglés (indexada primero); duplicarla en "/en/" sería contenido
    // duplicado para los buscadores.
    if (params.lang === "en") throw redirect({ to: "/" });
    if (params.lang !== "es" && params.lang !== "fr" && params.lang !== "ht") throw notFound();
  },
  head: ({ params }) => {
    const lang = params.lang as "es" | "fr" | "ht";
    const meta = SEO_META[lang];
    const base = "https://lajanrapid.app";
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { name: "robots", content: "index, follow, max-image-preview:large" },
        { property: "og:title", content: meta.ogTitle },
        { property: "og:description", content: meta.ogDescription },
      ],
      links: [
        { rel: "canonical", href: `${base}/${lang}/` },
        { rel: "alternate", hreflang: "en", href: `${base}/` },
        { rel: "alternate", hreflang: "es", href: `${base}/es/` },
        { rel: "alternate", hreflang: "fr", href: `${base}/fr/` },
        { rel: "alternate", hreflang: "ht", href: `${base}/ht/` },
        { rel: "alternate", hreflang: "x-default", href: `${base}/` },
      ],
    };
  },
  component: LocaleLanding,
});

function LocaleLanding() {
  const { lang: urlLang } = Route.useParams();
  const { lang, setLang } = useI18n();

  useEffect(() => {
    if (urlLang !== lang && (urlLang === "es" || urlLang === "fr" || urlLang === "ht")) {
      setLang(urlLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);

  return <Landing />;
}
