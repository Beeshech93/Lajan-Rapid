import { z } from "zod";

const credField = z.string().trim().optional();

export const bazikCredentialsSchema = z.object({
  BAZIK_BASE_URL: credField,
  BAZIK_USER_ID: credField,
  BAZIK_SECRET_KEY: credField,
  BAZIK_WEBHOOK_SECRET: credField,
  BAZIK_ENVIRONMENT: credField,
});

export type BazikCredentialsInput = z.infer<typeof bazikCredentialsSchema>;

export function parseBazikCredentialsInput(input: unknown): BazikCredentialsInput {
  return bazikCredentialsSchema.parse(input);
}
