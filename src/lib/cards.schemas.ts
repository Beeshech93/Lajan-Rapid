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

/** Configuración del programa (proveedor conmutable). */
export const cardProgramConfigSchema = z.object({
  CARD_PROVIDER: z.enum(["mock", "visa", "mastercard"]).optional(),
  VISA_ENABLED: z.enum(["true", "false"]).optional(),
  MASTERCARD_ENABLED: z.enum(["true", "false"]).optional(),
  VISA_BASE_URL: credField,
  VISA_API_KEY: credField,
  VISA_USER_ID: credField,
  MASTERCARD_BASE_URL: credField,
  MASTERCARD_API_KEY: credField,
  MASTERCARD_CLIENT_ID: credField,
  MASTERCARD_CLIENT_SECRET: credField,
});

export const issueCardSchema = z.object({
  walletId: z.string().uuid(),
  brand: z.enum(["visa", "mastercard"]),
  label: z.string().trim().max(60).optional(),
  disposable: z.boolean().default(false),
});

export const cardActionSchema = z.object({
  cardId: z.string().uuid(),
  action: z.enum(["freeze", "unfreeze", "terminate"]),
});

export type CardIssuerCredentialsInput = z.infer<typeof cardIssuerCredentialsSchema>;
export type RevealCardRequest = z.infer<typeof revealCardSchema>;
export type CardProgramConfigInput = z.infer<typeof cardProgramConfigSchema>;
export type IssueCardInput = z.infer<typeof issueCardSchema>;
export type CardActionInput = z.infer<typeof cardActionSchema>;

export const parseCardIssuerCredentials = (input: unknown) =>
  cardIssuerCredentialsSchema.parse(input);
export const parseRevealCardInput = (input: unknown) => revealCardSchema.parse(input);
export const parseCardProgramConfig = (input: unknown) => cardProgramConfigSchema.parse(input);
export const parseIssueCardInput = (input: unknown) => issueCardSchema.parse(input);
export const parseCardActionInput = (input: unknown) => cardActionSchema.parse(input);
