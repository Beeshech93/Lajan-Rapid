import { z } from "zod";

<<<<<<< Updated upstream
const credField = z.string().trim().max(500).optional();

export const stripeCredentialsSchema = z.object({
  STRIPE_SECRET_KEY: credField,
  STRIPE_WEBHOOK_SECRET: credField,
});

export type StripeCredentialsInput = z.infer<typeof stripeCredentialsSchema>;

export const parseStripeCredentialsInput = (input: unknown) =>
  stripeCredentialsSchema.parse(input);
=======
const credField = z.string().trim().min(10, "Credencial muy corta").max(1000);

export const mpCredentialsInputSchema = z.object({
  STRIPE_SECRET_KEY: credField.optional(),
  STRIPE_PUBLISHABLE_KEY: credField.optional(),
  STRIPE_WEBHOOK_SECRET: credField.optional(),
});

export type StripeCredentialsInput = z.infer<typeof mpCredentialsInputSchema>;

export function parseStripeCredentialsInput(
  input: unknown,
): StripeCredentialsInput {
  return mpCredentialsInputSchema.parse(input);
}
>>>>>>> Stashed changes
