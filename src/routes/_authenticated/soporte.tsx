import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getSupportConfig } from "@/lib/support.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte — Lajan Rapid" },
      { name: "description", content: "Resuelve dudas sobre envíos, pagos y verificación." },
      { property: "og:title", content: "Soporte — Lajan Rapid" },
      { property: "og:description", content: "Preguntas frecuentes y canales de atención." },
    ],
  }),
  component: Soporte,
});

function Soporte() {
  const { t } = useI18n();
  const FAQ = [
    { q: t("support.faq_q1"), a: t("support.faq_a1") },
    { q: t("support.faq_q2"), a: t("support.faq_a2") },
    { q: t("support.faq_q3"), a: t("support.faq_a3") },
    { q: t("support.faq_q4"), a: t("support.faq_a4") },
  ];
  const getConfig = useServerFn(getSupportConfig);
  const { data: config } = useQuery({
    queryKey: ["support_config"],
    queryFn: () => getConfig(),
  });

  const whatsapp = config?.whatsapp_number || "";
  const email = config?.email || "";
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t("support.title")}</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {whatsapp && (
          <Channel
            icon={<MessageCircle className="size-4" />}
            title={t("support.whatsapp")}
            value={whatsapp}
            {...(whatsappUrl ? { href: whatsappUrl } : {})}
          />
        )}
        {email && (
          <Channel
            icon={<Mail className="size-4" />}
            title={t("support.email")}
            value={email}
            href={`mailto:${email}`}
          />
        )}
        {!whatsapp && !email && (
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("support.no_channels")}</p>
        )}
      </div>

      {config?.support_hours && (
        <p className="text-sm text-muted-foreground">
          {t("support.hours")}: {config.support_hours}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("support.faq")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`i${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function Channel({
  icon,
  title,
  value,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon} {title}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </>
  );
  return (
    <Card>
      <CardContent className="p-4">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="block">
            {content}
          </a>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}
