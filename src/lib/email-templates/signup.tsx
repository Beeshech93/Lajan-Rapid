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

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({ siteName, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Bienvenido a {siteName}! Confirma tu correo para empezar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>¡Bienvenido a {siteName}! 🎉</Heading>
        <Text style={text}>
          Gracias por crear tu cuenta con <strong>{recipient}</strong>. Estás a un paso de poder
          enviar dinero, pagar recargas y mucho más de forma rápida y segura.
        </Text>
        <Text style={text}>Confirma tu correo electrónico para activar tu cuenta:</Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar mi correo
        </Button>
        <Text style={text}>
          Una vez confirmado, podrás iniciar sesión y comenzar a usar {siteName} de inmediato.
        </Text>
        <Text style={footer}>
          Si tú no creaste esta cuenta, puedes ignorar este correo con tranquilidad.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupEmail;

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
  margin: "0 0 25px",
};
const button = {
  backgroundColor: "#0b3a2e",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
