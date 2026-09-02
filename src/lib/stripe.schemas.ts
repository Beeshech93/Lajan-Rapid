import { z } from "zod";

const credField = z.string().trim().max(500).optional();

export const stripeCredentialsSchema = z.object({
  STRIPE_SECRET_KEY: credField,
  STRIPE_WEBHOOK_SECRET: credField,
});

export type StripeCredentialsInput = z.infer<typeof stripeCredentialsSchema>;

export const parseStripeCredentialsInput = (input: unknown) => stripeCredentialsSchema.parse(input);
