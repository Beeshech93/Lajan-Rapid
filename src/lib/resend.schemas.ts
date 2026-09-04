import { z } from "zod";

const credField = z.string().trim().optional();

export const resendCredentialsSchema = z.object({
  RESEND_API_KEY: credField,
  RESEND_FROM_EMAIL: credField,
  WELCOME_EMAIL_WEBHOOK_SECRET: credField,
});

export type ResendCredentialsInput = z.infer<typeof resendCredentialsSchema>;

export function parseResendCredentialsInput(input: unknown): ResendCredentialsInput {
  return resendCredentialsSchema.parse(input);
}
