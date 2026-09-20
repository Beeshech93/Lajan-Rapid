import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { ContentPage, type ContentSection } from "@/components/ContentPage";

const BASE = "https://lajanrapid.app";

export function hreflangLinks(path: string) {
  const p = path ? `/${path}` : "";
  return [
    { rel: "alternate", hreflang: "en", href: `${BASE}${p}` },
    { rel: "alternate", hreflang: "es", href: `${BASE}/es${p}/` },
    { rel: "alternate", hreflang: "fr", href: `${BASE}/fr${p}/` },
    { rel: "alternate", hreflang: "ht", href: `${BASE}/ht${p}/` },
    { rel: "alternate", hreflang: "x-default", href: `${BASE}${p}` },
  ];
}

export type PageContent = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: ContentSection[];
  cta: string;
};

export function LocaleContentPage({ urlLang, content }: { urlLang: string; content: PageContent }) {
  const { lang, setLang } = useI18n();

  useEffect(() => {
    if (urlLang !== lang && (urlLang === "es" || urlLang === "fr" || urlLang === "ht")) {
      setLang(urlLang as "es" | "fr" | "ht");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);

  return (
    <ContentPage
      heading={content.heading}
      intro={content.intro}
      sections={content.sections}
      cta={content.cta}
    />
  );
}
