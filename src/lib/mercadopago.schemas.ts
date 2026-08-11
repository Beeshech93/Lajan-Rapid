import { z } from "zod";

const credField = z.string().trim().max(500).optional();

export const mpCredentialsSchema = z.object({
  MERCADOPAGO_ACCESS_TOKEN: credField,
  MERCADOPAGO_WEBHOOK_SECRET: credField,
});

export type MpCredentialsInput = z.infer<typeof mpCredentialsSchema>;

export const parseMpCredentialsInput = (input: unknown) => mpCredentialsSchema.parse(input);
