import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MessageCircle } from "lucide-react";
import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupportConfig } from "@/lib/support.functions";
import { hreflangLinks } from "@/lib/seo-page-helpers";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contact Us | Lajan Rapid" },
      {
        name: "description",
        content: "Get in touch with Lajan Rapid support by WhatsApp or email.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Contact Us | Lajan Rapid" },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/contacto" },
      ...hreflangLinks("contacto"),
    ],
  }),
  component: ContactoPage,
});

function ContactoPage() {
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
        <h1 className="font-display text-3xl font-bold">Contact us</h1>
        <p className="mt-3 text-muted-foreground">
          Have a question before sending money? Reach our support team directly.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {whatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border p-4 hover:bg-secondary"
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <MessageCircle className="size-4" /> WhatsApp
              </p>
              <p className="mt-1 font-medium">{whatsapp}</p>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="rounded-xl border p-4 hover:bg-secondary">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Mail className="size-4" /> Email
              </p>
              <p className="mt-1 font-medium">{email}</p>
            </a>
          )}
          {!whatsapp && !email && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Contact channels haven't been set up yet.
            </p>
          )}
        </div>
        {config?.support_hours && (
          <p className="mt-4 text-sm text-muted-foreground">
            Support hours: {config.support_hours}
          </p>
        )}
      </section>
    </div>
  );
}
