import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de Privacidad — Lajan Rapid" },
      {
        name: "description",
        content:
          "Conoce cómo Lajan Rapid recopila, utiliza, almacena y protege tus datos personales en México, Haití y República Dominicana.",
      },
      { property: "og:title", content: "Política de Privacidad — Lajan Rapid" },
      {
        property: "og:description",
        content:
          "Conoce cómo Lajan Rapid recopila, utiliza, almacena y protege tus datos personales en México, Haití y República Dominicana.",
      },
      { property: "og:url", content: "https://lajanrapid.app/privacidad" },
      { property: "og:type", content: "article" },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/privacidad" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-primary p-1">
              <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Lajan Rapid
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 pb-20">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
            <Shield className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              Política de Privacidad
            </h1>
            <p className="text-sm text-muted-foreground">
              Fecha de entrada en vigor: 28 de agosto de 2026
            </p>
          </div>
        </div>

        <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-text-secondary">
          <Section title="1. Introducción">
            <p>
              Lajan Rapide ("Lajan Rapid", "nosotros", "nuestro" o "la Plataforma") respeta la privacidad y protección de los datos personales de sus usuarios.
            </p>
            <p>
              Esta Política de Privacidad explica cómo recopilamos, utilizamos, almacenamos, protegemos y, cuando corresponda, compartimos información personal cuando una persona utiliza:
            </p>
            <List items={[
              "La aplicación móvil Lajan Rapid",
              "El sitio web de Lajan Rapid",
              "La plataforma web",
              "Los servicios de transferencia de dinero",
              "Wallets y servicios de pago",
              "Recargas móviles",
              "Servicios relacionados con MonCash y NatCash",
              "Atención al cliente",
              "Programas de referidos",
              "Otros servicios ofrecidos por Lajan Rapid",
            ]} />
            <p>
              Esta Política está diseñada para operar en México, Haití y República Dominicana, sin perjuicio de otras obligaciones legales que puedan resultar aplicables según el país, producto o servicio.
            </p>
          </Section>

          <Section title="2. Responsable del tratamiento">
            <List items={[
              "Responsable: LAJAN RAPIDE",
              "Domicilio: CIUDAD DE MÉXICO",
              "Correo de privacidad: privacy@lajanrapide.com",
              "Correo de soporte: support@lajanrapide.com",
              "Sitio web: lajanrapid.app",
            ]} />
            <p>
              Antes de publicar esta Política, Lajan Rapid deberá completar los datos legales de la sociedad responsable, domicilio, correo oficial y, cuando corresponda, representante o encargado de privacidad.
            </p>
          </Section>

          <Section title="3. Marco legal">
            <p>
              Lajan Rapide aplicará las normas de protección de datos que correspondan a cada operación y jurisdicción.
            </p>
            <h3 className="font-display text-base font-semibold text-foreground">México</h3>
            <p>
              Cuando resulte aplicable, el tratamiento de datos personales de usuarios en México se realizará conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, cuya versión vigente contempla obligaciones para responsables particulares y derechos ARCO.
            </p>
            <h3 className="font-display text-base font-semibold text-foreground">República Dominicana</h3>
            <p>
              Cuando resulte aplicable, el tratamiento se realizará conforme a la Ley No. 172-13 sobre Protección de Datos Personales y demás normativa aplicable.
            </p>
            <h3 className="font-display text-base font-semibold text-foreground">Haití</h3>
            <p>
              Lajan Rapide aplicará las normas haitianas correspondientes al tratamiento de datos personales y privacidad. Las reglas publicadas en Haití establecen principios relacionados con pertinencia, necesidad, conservación, confidencialidad, acceso autorizado, seguridad y rectificación de datos personales.
            </p>
            <p>
              Cuando una legislación local establezca requisitos adicionales, prevalecerán las obligaciones legales aplicables a la operación correspondiente.
            </p>
          </Section>

          <Section title="4. Información que recopilamos">
            <p>Dependiendo de los servicios utilizados, podemos recopilar las siguientes categorías de información.</p>
            <h3 className="font-display text-base font-semibold text-foreground">4.1 Información de identificación</h3>
            <List items={[
              "Nombre", "Apellidos", "Fecha de nacimiento", "Nacionalidad", "País de residencia",
              "Documento de identidad", "Número de identificación", "Fotografía", "Información necesaria para verificar identidad",
            ]} />
            <h3 className="font-display text-base font-semibold text-foreground">4.2 Información de contacto</h3>
            <List items={[
              "Número telefónico", "Correo electrónico", "Dirección", "Ciudad", "País", "Información de contacto del beneficiario",
            ]} />
            <h3 className="font-display text-base font-semibold text-foreground">4.3 Información KYC</h3>
            <List items={[
              "Documento oficial de identidad", "Fotografías del documento", "Selfie o verificación facial",
              "Información de domicilio", "Información necesaria para verificar identidad",
              "Información relacionada con el origen y propósito de determinados fondos cuando sea legalmente necesario",
            ]} />
            <p>Estos datos pueden ser procesados por proveedores especializados de KYC y cumplimiento.</p>
          </Section>

          <Section title="5. Información financiera">
            <p>Cuando el usuario utiliza servicios financieros podemos recopilar información relacionada con:</p>
            <List items={[
              "Operaciones", "Montos", "Monedas", "Comisiones", "Beneficiarios", "Métodos de pago",
              "Referencias de transacciones", "Estados de operaciones", "Historial de transferencias",
              "Información de wallets", "Información relacionada con tarjetas",
            ]} />
            <p className="rounded-xl border border-border bg-secondary p-4 text-foreground">
              Importante: Lajan Rapid no almacena el PAN completo ni el CVV de las tarjetas. Los datos sensibles son gestionados por proveedores certificados conforme a PCI DSS.
            </p>
          </Section>

          <Section title="6. Información de MonCash y NatCash">
            <p>
              Cuando el usuario utilice servicios relacionados con MonCash, NatCash u otros proveedores de dinero móvil, podremos procesar información necesaria para ejecutar y registrar la operación.
            </p>
            <List items={[
              "Número de teléfono", "Beneficiario", "Monto", "Moneda", "Referencia",
              "Estado de la operación", "Identificador proporcionado por el proveedor",
            ]} />
            <p>El tratamiento también podrá estar sujeto a las políticas y condiciones del proveedor correspondiente.</p>
          </Section>

          <Section title="7. Información del dispositivo">
            <p>Podemos recopilar información técnica como:</p>
            <List items={[
              "Dirección IP", "Tipo de dispositivo", "Sistema operativo", "Versión de aplicación",
              "Idioma", "Zona horaria", "Identificadores técnicos", "Información del navegador",
              "Registros de acceso", "Información de seguridad",
            ]} />
            <p>Esta información se utiliza principalmente para seguridad, prevención de fraude, funcionamiento y diagnóstico técnico.</p>
          </Section>

          <Section title="8. Información de localización">
            <p>
              Lajan Rapide podrá solicitar información de ubicación cuando sea necesaria para determinadas funcionalidades.
            </p>
            <p>
              Cuando la ubicación precisa no sea necesaria, procuraremos utilizar información menos precisa. El usuario podrá controlar los permisos de ubicación desde su dispositivo, salvo cuando exista una obligación legal o una necesidad legítima de seguridad que permita otro tratamiento.
            </p>
          </Section>

          <Section title="9. Información de uso">
            <p>Podemos recopilar información sobre cómo el usuario utiliza la Plataforma:</p>
            <List items={[
              "Pantallas visitadas", "Funciones utilizadas", "Fecha y hora de acceso", "Errores técnicos",
              "Interacciones con determinadas funciones", "Información de rendimiento",
            ]} />
            <p>Esta información ayuda a mejorar la seguridad, estabilidad y experiencia del usuario.</p>
          </Section>

          <Section title="10. Finalidades del tratamiento">
            <p>Utilizamos los datos personales para:</p>
            <h3 className="font-display text-base font-semibold text-foreground">Finalidades principales</h3>
            <List items={[
              "Crear y administrar cuentas", "Verificar identidad", "Realizar procesos KYC", "Procesar transferencias",
              "Procesar pagos", "Gestionar wallets", "Gestionar tarjetas", "Procesar recargas",
              "Gestionar operaciones relacionadas con MonCash y NatCash", "Gestionar compras online",
              "Gestionar logística", "Enviar notificaciones de operaciones", "Proporcionar atención al cliente",
              "Prevenir fraude", "Detectar actividades sospechosas", "Cumplir obligaciones legales",
              "Cumplir obligaciones regulatorias", "Mantener la seguridad de la Plataforma",
            ]} />
            <h3 className="font-display text-base font-semibold text-foreground">Finalidades secundarias</h3>
            <p>Cuando corresponda y exista una base legal válida:</p>
            <List items={[
              "Marketing", "Promociones", "Programas de referidos", "Análisis estadístico",
              "Personalización de comunicaciones", "Mejora de productos",
            ]} />
            <p>El usuario podrá ejercer los mecanismos disponibles para limitar determinadas comunicaciones promocionales.</p>
          </Section>

          <Section title="11. Bases para el tratamiento">
            <p>Dependiendo de la jurisdicción y del tratamiento concreto, podremos tratar datos con base en:</p>
            <List items={[
              "Consentimiento", "Ejecución de un contrato", "Cumplimiento de obligaciones legales",
              "Prevención de fraude", "Seguridad", "Interés legítimo cuando sea legalmente aplicable",
              "Cumplimiento de obligaciones regulatorias",
            ]} />
            <p>No utilizaremos una única base jurídica para todos los tratamientos.</p>
          </Section>

          <Section title="12. KYC, prevención de fraude y cumplimiento">
            <p>Los servicios financieros pueden requerir procedimientos de identificación y monitoreo.</p>
            <p>Podemos utilizar sistemas automatizados y/o revisión humana para:</p>
            <List items={[
              "Verificar identidad", "Detectar fraude", "Detectar patrones sospechosos", "Evaluar riesgo",
              "Prevenir uso ilícito de la Plataforma", "Cumplir obligaciones regulatorias",
            ]} />
            <p>
              Cuando la legislación aplicable otorgue derechos respecto de decisiones automatizadas, Lajan Rapide implementará los mecanismos correspondientes.
            </p>
          </Section>

          <Section title="13. Compartición de información">
            <p>Podemos compartir información personal cuando sea necesario con:</p>
            <List items={[
              "Proveedores de KYC", "Procesadores de pagos", "Proveedores de tarjetas", "Proveedores de transferencias",
              "Proveedores de recargas", "Proveedores de dinero móvil", "Proveedores tecnológicos",
              "Proveedores de almacenamiento", "Proveedores de logística", "Proveedores de atención al cliente",
              "Proveedores de prevención de fraude", "Auditores", "Asesores profesionales",
              "Autoridades competentes cuando exista obligación legal",
            ]} />
            <p>Los proveedores únicamente deberán recibir la información necesaria para realizar la función correspondiente.</p>
          </Section>

          <Section title="14. Transferencias internacionales">
            <p>
              Debido a la naturaleza internacional de Lajan Rapide, determinada información puede ser procesada o almacenada fuera del país de residencia del usuario.
            </p>
            <p>
              Lajan Rapide adoptará las medidas contractuales, técnicas y organizativas requeridas por la legislación aplicable para dichas transferencias. Cuando una transferencia requiera consentimiento o información específica, se proporcionará el mecanismo correspondiente.
            </p>
          </Section>

          <Section title="15. Conservación de datos">
            <p>Conservaremos los datos personales durante el periodo necesario para:</p>
            <List items={[
              "Proporcionar el servicio", "Mantener registros de operaciones", "Cumplir obligaciones legales",
              "Cumplir obligaciones regulatorias", "Resolver reclamaciones", "Prevenir fraude", "Defender derechos legales",
            ]} />
            <p>
              Los plazos pueden variar según el tipo de información y el país. Cuando los datos ya no sean necesarios, serán eliminados, anonimizados o bloqueados cuando corresponda.
            </p>
          </Section>

          <Section title="16. Seguridad">
            <p>Lajan Rapide implementará medidas técnicas y organizativas razonables para proteger los datos:</p>
            <List items={[
              "Cifrado en tránsito", "Cifrado de información sensible cuando corresponda", "Control de acceso",
              "Autenticación multifactor", "Gestión de sesiones", "Registro de actividad", "Monitorización",
              "Segmentación de sistemas", "Backups protegidos", "Control de privilegios", "Gestión de vulnerabilidades",
              "Pruebas de seguridad",
            ]} />
            <p>El acceso interno a datos personales estará limitado según las funciones y responsabilidades.</p>
          </Section>

          <Section title="17. Contraseñas y códigos">
            <p>Lajan Rapide no solicitará al usuario que comparta:</p>
            <List items={[
              "Contraseña", "PIN", "CVV", "Código OTP", "Claves privadas", "Códigos de recuperación",
            ]} />
            <p>El usuario nunca debe compartir estas credenciales con terceros.</p>
          </Section>

          <Section title="18. Cookies y tecnologías similares">
            <p>El sitio web puede utilizar:</p>
            <List items={[
              "Cookies necesarias", "Cookies de seguridad", "Cookies analíticas", "Tecnologías de rendimiento",
              "Tecnologías de preferencias",
            ]} />
            <p>
              Cuando la legislación aplicable lo requiera, se solicitará el consentimiento correspondiente. El usuario podrá controlar determinadas cookies mediante la configuración del navegador o mediante el mecanismo de preferencias disponible en el sitio.
            </p>
          </Section>

          <Section title="19. Marketing">
            <p>
              Podremos enviar comunicaciones promocionales cuando exista una base legal válida y, cuando sea necesario, consentimiento.
            </p>
            <p>El usuario podrá cancelar comunicaciones promocionales mediante:</p>
            <List items={[
              "El enlace de cancelación", "Configuración de la cuenta", "Contacto con soporte",
            ]} />
            <p>
              Las comunicaciones esenciales relacionadas con seguridad, operaciones y transacciones pueden continuar siendo enviadas aunque el usuario haya rechazado comunicaciones comerciales.
            </p>
          </Section>

          <Section title="20. Derechos del usuario en México">
            <p>Cuando resulte aplicable la legislación mexicana, el usuario podrá ejercer los derechos:</p>
            <List items={[
              "Acceso — Conocer qué datos personales tratamos",
              "Rectificación — Solicitar corrección de información incorrecta",
              "Cancelación — Solicitar la eliminación cuando legalmente proceda",
              "Oposición — Oponerse a determinados tratamientos cuando legalmente proceda",
            ]} />
            <p>Las solicitudes podrán enviarse a: privacy@lajanrapide.com</p>
          </Section>

          <Section title="21. Derechos en República Dominicana">
            <p>
              Los usuarios de República Dominicana podrán ejercer los derechos reconocidos por la legislación aplicable, incluyendo los mecanismos establecidos por la Ley No. 172-13.
            </p>
            <p>
              La solicitud deberá incluir información suficiente para verificar la identidad del solicitante y localizar los datos correspondientes. Lajan Rapide responderá conforme a los plazos y procedimientos establecidos por la legislación aplicable.
            </p>
          </Section>

          <Section title="22. Derechos en Haití">
            <p>Los usuarios en Haití podrán solicitar, cuando corresponda:</p>
            <List items={[
              "Acceso a sus datos", "Corrección de información incorrecta", "Información sobre determinados tratamientos",
              "Protección frente a divulgaciones no autorizadas",
            ]} />
            <p>
              Lajan Rapide implementará procedimientos adecuados para gestionar dichas solicitudes de acuerdo con la legislación aplicable.
            </p>
          </Section>

          <Section title="23. Solicitudes de privacidad">
            <p>Para realizar una solicitud relacionada con privacidad, el usuario deberá contactar:</p>
            <List items={[
              "Correo: privacy@lajanrapide.com",
              "Asunto recomendado: SOLICITUD DE PRIVACIDAD — LAJAN RAPIDE",
            ]} />
            <p>La solicitud deberá incluir:</p>
            <List items={[
              "Nombre", "Información suficiente para identificar la cuenta", "Tipo de solicitud",
              "Descripción de la información solicitada", "Información necesaria para verificar identidad",
            ]} />
            <p>Podremos solicitar información adicional para evitar que una persona no autorizada acceda a datos personales.</p>
          </Section>

          <Section title="24. Datos de menores">
            <p>
              Lajan Rapide no está diseñada para que menores de edad utilicen servicios financieros sin cumplir los requisitos legales aplicables. Cuando la legislación exija consentimiento o autorización de un padre, madre o representante legal, se aplicarán los mecanismos correspondientes.
            </p>
          </Section>

          <Section title="25. Enlaces a terceros">
            <p>
              La aplicación puede contener enlaces a servicios de terceros. Lajan Rapide no controla necesariamente las políticas de privacidad de esos terceros. El usuario debe consultar sus respectivas políticas antes de proporcionar información personal.
            </p>
          </Section>

          <Section title="26. Proveedores financieros">
            <p>
              Los servicios financieros pueden depender de instituciones, procesadores, emisores, proveedores de tarjetas, redes de pago y otras entidades. El tratamiento realizado directamente por esos proveedores puede estar sujeto a sus propias políticas de privacidad.
            </p>
          </Section>

          <Section title="27. Incidentes de seguridad">
            <p>En caso de detectar un incidente de seguridad que afecte datos personales, Lajan Rapide implementará procedimientos internos para:</p>
            <List items={[
              "Contener el incidente", "Investigar su alcance", "Proteger los sistemas", "Evaluar los riesgos",
              "Documentar el incidente", "Notificar a usuarios o autoridades cuando legalmente corresponda",
            ]} />
          </Section>

          <Section title="28. Cambios a esta política">
            <p>
              Podemos modificar esta Política de Privacidad cuando sea necesario. La versión actual estará disponible dentro de la aplicación y/o sitio web.
            </p>
            <p>Cuando un cambio sea material y la legislación lo requiera, podremos comunicarlo mediante:</p>
            <List items={[
              "Correo electrónico", "Notificación dentro de la aplicación", "Aviso en el sitio web", "Otros mecanismos legalmente válidos",
            ]} />
            <p>La fecha de actualización aparecerá al inicio de esta Política.</p>
          </Section>

          <Section title="29. Contacto">
            <p>Para preguntas, solicitudes o reclamaciones relacionadas con privacidad:</p>
            <List items={[
              "LAJAN RAPIDE — Privacy Department",
              "Correo: privacy@lajanrapide.com",
              "Soporte: support@lajanrapide.com",
              "Sitio web: lajanrapid.app",
            ]} />
          </Section>

          <Section title="30. Aceptación y constancia">
            <p>Cuando sea requerido, Lajan Rapide registrará:</p>
            <List items={[
              "Fecha y hora de aceptación", "Versión de la Política", "Usuario", "Método de consentimiento",
              "Información necesaria para demostrar el consentimiento",
            ]} />
            <p>
              La aceptación de esta Política no sustituye los consentimientos específicos que puedan ser necesarios para determinados tratamientos.
            </p>
          </Section>

          <Section title="Resumen para el usuario">
            <p>En términos sencillos:</p>
            <List items={[
              "Lajan Rapide recopila información para poder identificarte, procesar tus operaciones, proteger tu cuenta, prevenir fraude y cumplir la legislación.",
              "No venderemos datos personales como producto.",
              "Compartiremos información únicamente cuando sea necesario para prestar servicios, proteger la Plataforma, cumplir obligaciones legales o realizar operaciones solicitadas.",
              "Puedes contactar a Lajan Rapide para ejercer los derechos que correspondan sobre tus datos.",
            ]} />
            <p className="pt-4 font-display text-lg font-semibold text-foreground">LAJAN RAPIDE</p>
            <p className="text-muted-foreground">Tu dinero. Tu mundo.</p>
          </Section>
        </article>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Lajan Rapid. Todos los derechos reservados.</p>
        <p className="mt-1">
          <Link to="/" className="underline hover:text-foreground">Volver al inicio</Link>
        </p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="mb-3 font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-muted-foreground">
          <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
