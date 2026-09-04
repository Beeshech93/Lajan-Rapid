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

const FAQ = [
  {
    q: "¿Cuánto tarda un envío?",
    a: "Después de confirmar tu pago, la mayoría de los envíos están disponibles en Haití en menos de 30 minutos.",
  },
  {
    q: "¿Por qué necesito verificar mi identidad?",
    a: "La regulación mexicana exige verificar la identidad de quien envía dinero al extranjero. Solo lo haces una vez.",
  },
  {
    q: "¿Qué métodos de pago aceptan?",
    a: "OXXO, Mercado Pago, transferencia SPEI y tarjeta de débito.",
  },
  {
    q: "¿Puedo cancelar un envío?",
    a: "Sí, mientras esté en estado 'Esperando pago'. Después de confirmado, escríbenos a soporte.",
  },
];

function Soporte() {
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
      <h1 className="text-2xl font-bold">Soporte</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {whatsapp && (
          <Channel
            icon={<MessageCircle className="size-4" />}
            title="WhatsApp"
            value={whatsapp}
            {...(whatsappUrl ? { href: whatsappUrl } : {})}
          />
        )}
        {email && (
          <Channel
            icon={<Mail className="size-4" />}
            title="Correo"
            value={email}
            href={`mailto:${email}`}
          />
        )}
        {!whatsapp && !email && (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Todavía no se configuraron los canales de contacto.
          </p>
        )}
      </div>

      {config?.support_hours && (
        <p className="text-sm text-muted-foreground">Horario de atención: {config.support_hours}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preguntas frecuentes</CardTitle>
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
