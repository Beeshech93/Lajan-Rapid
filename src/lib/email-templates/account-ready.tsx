import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface AccountReadyEmailProps {
  siteName: string;
  siteUrl: string;
  fullName?: string;
}

export const AccountReadyEmail = ({ siteName, siteUrl, fullName }: AccountReadyEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu cuenta de {siteName} ya está lista</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>¡Ya estás listo, {fullName || "amigo"}! 🚀</Heading>
        <Text style={text}>
          Tu cuenta de {siteName} está confirmada y activa. Ya puedes empezar a usar todos nuestros
          servicios:
        </Text>
        <Text style={item}>💸 Enviar dinero a Haití y República Dominicana</Text>
        <Text style={item}>📱 Recargar saldo de celular al instante</Text>
        <Text style={item}>💳 Pagar con tarjeta, OXXO, SPEI o transferencia</Text>
        <Button style={button} href={siteUrl}>
          Ir a mi cuenta
        </Button>
        <Text style={footer}>
          ¿Tienes dudas? Visita la sección de Soporte dentro de la app, estamos para ayudarte.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default AccountReadyEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#0b3a2e",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 15px",
};
const item = {
  fontSize: "14px",
  color: "#0b3a2e",
  lineHeight: "1.6",
  margin: "0 0 6px",
};
const button = {
  backgroundColor: "#0b3a2e",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
  display: "inline-block" as const,
  marginTop: "15px",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
