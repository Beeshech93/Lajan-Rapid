import { z } from "zod";

export const bazikTopupSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["MXN", "USD", "HTG", "DOP", "EUR"]),
});

export const bazikPayoutSchema = z.object({
  provider: z.enum(["moncash", "natcash"]),
  phone: z.string().min(6).max(20),
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(["HTG", "USD"]),
});

const credField = z.string().trim().max(500).optional();

export const bazikCredentialsSchema = z.object({
  BAZIK_BASE_URL: credField,
  BAZIK_USER_ID: credField,
  BAZIK_SECRET_KEY: credField,
  BAZIK_WEBHOOK_SECRET: credField,
  BAZIK_COLLECT_API_KEY: credField,
  BAZIK_COLLECT_API_SECRET: credField,
  BAZIK_PAYOUT_API_KEY: credField,
  BAZIK_PAYOUT_API_SECRET: credField,
});

export type BazikTopupRequest = z.infer<typeof bazikTopupSchema>;
export type BazikPayoutRequest = z.infer<typeof bazikPayoutSchema>;
export type BazikCredentialsInput = z.infer<typeof bazikCredentialsSchema>;

export const parseBazikTopupInput = (input: unknown) => bazikTopupSchema.parse(input);
export const parseBazikPayoutInput = (input: unknown) => bazikPayoutSchema.parse(input);
export const parseBazikCredentialsInput = (input: unknown) => bazikCredentialsSchema.parse(input);

