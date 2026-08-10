import { z } from "zod";

const credField = z.string().trim().max(500).optional();

/** Credenciales del proveedor emisor de tarjetas virtuales. */
export const cardIssuerCredentialsSchema = z.object({
  CARD_API_BASE_URL: credField,
  CARD_API_KEY: credField,
  CARD_API_SECRET: credField,
});

export const revealCardSchema = z.object({
  cardId: z.string().uuid(),
});

export type CardIssuerCredentialsInput = z.infer<typeof cardIssuerCredentialsSchema>;
export type RevealCardRequest = z.infer<typeof revealCardSchema>;

export const parseCardIssuerCredentials = (input: unknown) =>
  cardIssuerCredentialsSchema.parse(input);
export const parseRevealCardInput = (input: unknown) => revealCardSchema.parse(input);
