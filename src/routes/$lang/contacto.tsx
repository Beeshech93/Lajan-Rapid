import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Mail, MessageCircle } from "lucide-react";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupportConfig } from "@/lib/support.functions";
import { hreflangLinks } from "@/lib/seo-page-helpers";
import { useI18n } from "@/lib/i18n";

const TITLES: Record<"es" | "fr" | "ht", { title: string; description: string }> = {
  es: {
    title: "Contacto | Lajan Rapid",
    description: "Contacta al soporte de Lajan Rapid por WhatsApp o correo.",
  },
  fr: {
    title: "Contact | Lajan Rapid",
    description: "Contactez le support de Lajan Rapid par WhatsApp ou e-mail.",
  },
  ht: {
    title: "Kontak | Lajan Rapid",
    description: "Kontakte sipò Lajan Rapid pa WhatsApp oswa imèl.",
  },
};

export const Route = createFileRoute("/$lang/contacto")({
  beforeLoad: ({ params }) => {
    if (params.lang === "en") throw redirect({ to: "/contacto" });
    if (params.lang !== "es" && params.lang !== "fr" && params.lang !== "ht") throw notFound();
  },
  head: ({ params }) => {
    const lang = params.lang as "es" | "fr" | "ht";
    const c = TITLES[lang];
    return {
      meta: [
        { title: c.title },
        { name: "description", content: c.description },
        { name: "robots", content: "index, follow" },
      ],
      links: [
        { rel: "canonical", href: `https://lajanrapid.app/${lang}/contacto` },
        ...hreflangLinks("contacto"),
      ],
    };
  },
  component: LocaleContacto,
});

function LocaleContacto() {
  const { lang: urlLang } = Route.useParams();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    if (urlLang !== lang && (urlLang === "es" || urlLang === "fr" || urlLang === "ht")) {
      setLang(urlLang as "es" | "fr" | "ht");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);

  const getConfig = useServerFn(getSupportConfig);
  const { data: config } = useQuery({
    queryKey: ["support_config_public"],
    queryFn: () => getConfig(),
  });

  const whatsapp = config?.whatsapp_number || "";
  const email = config?.email || "";
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1 shadow-soft">
            <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Lajan Rapid</span>
        </Link>
        <LanguageSwitcher className="h-9 w-[132px] text-xs" />
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-16 pt-4">
        <h1 className="font-display text-3xl font-bold">{t("support.title")}</h1>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {whatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border p-4 hover:bg-secondary"
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <MessageCircle className="size-4" /> {t("support.whatsapp")}
              </p>
              <p className="mt-1 font-medium">{whatsapp}</p>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="rounded-xl border p-4 hover:bg-secondary">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Mail className="size-4" /> {t("support.email")}
              </p>
              <p className="mt-1 font-medium">{email}</p>
            </a>
          )}
          {!whatsapp && !email && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {t("support.no_channels")}
            </p>
          )}
        </div>
        {config?.support_hours && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("support.hours")}: {config.support_hours}
          </p>
        )}
      </section>
    </div>
  );
}
